import { Context, Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { signInSchema, signUpSchema } from "@festhub/shared/validation";
import { db, isDBError } from "@festhub/db";
import {
  usersTable,
  studentsTable,
  refreshTokensTable,
  teacherInvitesTable,
  teachersTable,
  UserSelect,
} from "@festhub/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import bcrypt from "bcrypt";
import {
  generateAccessToken,
  generateRefreshToken,
  JWTPayload,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import dayjs from "dayjs";
import { success } from "zod";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { BadRequestException } from "../exceptions/bad-request-exception.js";

async function generateTokenAndSetCookies(
  c: Context,
  payload: {
    sub: string;
    role: JWTPayload["role"];
    jid: string;
    familyId: string;
  },
) {
  const [acToken, rfToken] = await Promise.allSettled([
    generateAccessToken({
      sub: payload.sub,
      role: payload.role,
    }),
    generateRefreshToken({
      sub: payload.sub,
      role: payload.role,
      jid: payload.jid,
      familyId: payload.familyId,
    }),
  ]);

  if (acToken.status === "rejected" || rfToken.status === "rejected") {
    throw new HTTPException(500, {
      message: "Failed to generate tokens",
    });
  }

  setCookie(c, "ac_token", acToken.value, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15, // 15 minutes
  });

  setCookie(c, "rf_token", rfToken.value, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

const app = new Hono()
  .post("/sign-in", zValidator("json", signInSchema), async (c) => {
    const { email, password } = c.req.valid("json");

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (users.length === 0 || !users[0]) {
      throw new HTTPException(401, {
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      users[0].passwordHash,
    );

    if (!isPasswordValid) {
      throw new HTTPException(401, {
        message: "Invalid email or password",
      });
    }

    try {
      const familyId = crypto.randomUUID();

      const expiresAt = dayjs().add(7, "day").toDate();

      const [token] = await db
        .insert(refreshTokensTable)
        .values({
          familyId,
          expiresAt: expiresAt,
          userId: users[0].id,
        })
        .returning({ jid: refreshTokensTable.jid });

      if (!token?.jid)
        throw new HTTPException(500, { message: "Internal Server Error" });

      await generateTokenAndSetCookies(c, {
        sub: users[0].id,
        jid: token.jid,
        familyId,
        role: users[0].role,
      });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new InternalServerErrorException(
        "Error occured signing you in",
        err,
      );
    }

    return c.json({
      message: "Sign in successful",
    });
  })
  .post("/sign-up", zValidator("json", signUpSchema), async (c) => {
    const input = c.req.valid("json");

    try {
      const newUser = await db.transaction(async (tx) => {
        const existingUser = await tx
          .select({
            id: usersTable.id,
          })
          .from(usersTable)
          .where(eq(usersTable.email, input.email));

        if (existingUser.length > 0) {
          throw new BadRequestException("User already exists");
        }

        let role: "student" | "teacher" = "student";

        if (input.role === "teacher") {
          const [teacher] = await tx
            .select()
            .from(teacherInvitesTable)
            .where(eq(teacherInvitesTable.email, input.email));

          if (!teacher || teacher.acceptedAt) {
            throw new BadRequestException(
              "A valid invitation is required to sign up as a teacher.",
            );
          }

          role = "teacher";
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);

        const [newUser] = await tx
          .insert(usersTable)
          .values({
            email: input.email,
            passwordHash: hashedPassword,
            name: input.name,
            role,
          })
          .returning();

        if (!newUser) {
          throw new InternalServerErrorException("Failed to create a user");
        }

        try {
          if (input.role == "teacher") {
            await tx.insert(teachersTable).values({
              teacherId: input.teacherId,
              department: input.department,
              userId: newUser.id,
            });
          } else {
            await tx.insert(studentsTable).values({
              studentId: input.studentId,
              department: input.department,
              batch: input.batch,
              userId: newUser.id,
              is_hsc: input.is_hsc,
            });
          }
        } catch (err) {
          if (isDBError(err)) {
            if (err.cause.code === "23505") {
              throw new BadRequestException(
                `${input.role === "teacher" ? "Teacher" : "Student"} ID must be unique. The provided ID already exists.`,
              );
            }
          }
        }

        return newUser;
      });

      const familyId = crypto.randomUUID();

      const [token] = await db
        .insert(refreshTokensTable)
        .values({
          familyId,
          userId: newUser.id,
          expiresAt: dayjs().add(7, "day").toDate(),
        })
        .returning({ jid: refreshTokensTable.jid });

      if (!token) throw new InternalServerErrorException();

      await generateTokenAndSetCookies(c, {
        sub: newUser.id,
        familyId,
        jid: token.jid,
        role: newUser.role,
      });

      return c.json({
        message: "User created successfully",
      });
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }

      throw new InternalServerErrorException("Failed to create a user", err);
    }
  })
  .post("/sign-out", async (c) => {
    const rfToken = getCookie(c, "rf_token");

    if (rfToken) {
      try {
        const payload = await verifyRefreshToken(rfToken);

        await db
          .update(refreshTokensTable)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(refreshTokensTable.familyId, payload.familyId),
              isNull(refreshTokensTable.revokedAt),
            ),
          );
      } catch {}
    }

    deleteCookie(c, "ac_token", {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    });
    deleteCookie(c, "rf_token", {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    });

    return c.json({
      message: "Sign out successful",
    });
  })
  .post("/refresh-token", async (c) => {
    const rfToken = getCookie(c, "rf_token");

    if (!rfToken) {
      throw new HTTPException(401, {
        message: "Refresh token not found",
      });
    }

    let payload: JWTPayload;
    try {
      payload = await verifyRefreshToken(rfToken);
    } catch (err) {
      throw new HTTPException(401, {
        message: "Invalid or expired refresh token",
      });
    }

    let result: { success: boolean; message: string; user?: UserSelect };

    result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, payload.sub));

      if (!user) {
        return {
          success: false,
          message: "User not found.",
        };
      }

      const now = new Date();

      const [consumedToken] = await tx
        .update(refreshTokensTable)
        .set({
          usedAt: now,
        })
        .where(
          and(
            eq(refreshTokensTable.jid, payload.jid),
            eq(refreshTokensTable.familyId, payload.familyId),
            eq(refreshTokensTable.userId, payload.sub),
            isNull(refreshTokensTable.revokedAt),
            isNull(refreshTokensTable.usedAt),
            gt(refreshTokensTable.expiresAt, now),
          ),
        )
        .returning({ jid: refreshTokensTable.jid });

      if (!consumedToken) {
        const [currentToken] = await tx
          .select()
          .from(refreshTokensTable)
          .where(eq(refreshTokensTable.jid, payload.jid));

        if (
          currentToken &&
          currentToken.familyId === payload.familyId &&
          currentToken.userId === payload.sub &&
          currentToken.usedAt !== null
        ) {
          await tx
            .update(refreshTokensTable)
            .set({ revokedAt: now })
            .where(
              and(
                eq(refreshTokensTable.familyId, payload.familyId),
                isNull(refreshTokensTable.revokedAt),
              ),
            );
        }

        return {
          success: false,
          message: "Unauthorized",
        };
      }

      return {
        success: true,
        message: "Success",
        user: user,
      };
    });

    if (!result.success || !result.user)
      throw new HTTPException(401, { message: "Unauthorized" });

    const [newToken] = await db
      .insert(refreshTokensTable)
      .values({
        familyId: payload.familyId,
        userId: payload.sub,
        expiresAt: dayjs().add(7, "day").toDate(),
      })
      .returning({ jid: refreshTokensTable.jid });

    if (!newToken)
      throw new HTTPException(500, { message: "Internal server error" });

    await generateTokenAndSetCookies(c, {
      jid: newToken.jid,
      familyId: payload.familyId,
      role: result.user.role,
      sub: result.user.id,
    });

    return c.json({
      message: "Token refreshed successfully",
    });
  });

export default app;
