import { Hono } from "hono";
import { enforceAuthMiddleware } from "../../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  participantsTable,
  studentsTable,
  teamsTable,
  usersTable,
  volunteersTable,
} from "@festhub/db/schema";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";

function verifyAndExtractQrToken(token: string, type: "student" | "event") {
  const tokenParts = token.split(":");

  if (
    tokenParts.length < 3 ||
    tokenParts[0] !== "qr" ||
    (type === "student" && tokenParts[1] !== "s") ||
    (type === "event" && tokenParts[1] !== "e")
  )
    throw new BadRequestException("Invalid Token Format");

  const tokenUUID = tokenParts[2];

  const isUUID = z.uuid().safeParse(tokenUUID).success;

  if (!tokenUUID || !isUUID)
    throw new BadRequestException("The QR token is not valid");

  return tokenUUID;
}

const app = new Hono()
  .get(
    "qr",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator(
      "param",
      z.object({
        id: z.uuid(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");

      const qrToken = await db.transaction(async (tx) => {
        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.id, id))
          .for("update");

        if (!event) throw new BadRequestException("Event not found");

        let qrToken: string;

        if (!event.attendanceQrToken) {
          const token = randomUUID();

          await tx
            .update(eventsTable)
            .set({ attendanceQrToken: token })
            .where(eq(eventsTable.id, event.id));

          qrToken = token;
        } else qrToken = event.attendanceQrToken;

        return qrToken;
      });

      return c.json({ attendanceQrToken: `qr:e:${qrToken}` });
    },
  )
  .put(
    "/qr/rotate",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const token = randomUUID();

      await db
        .update(eventsTable)
        .set({ attendanceQrToken: token })
        .where(eq(eventsTable.id, id));

      return c.json({
        attendanceQrToken: `qr:e:${token}`,
      });
    },
  )
  .post(
    "/self",
    enforceAuthMiddleware(["student"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", z.object({ qrToken: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { qrToken } = c.req.valid("json");
      const user = c.var.user;

      const tokenParts = qrToken.split(":");

      if (tokenParts[0] !== "qr" || tokenParts[1] !== "e")
        throw new BadRequestException("Invalid qr token format");

      const attendanceQrToken = tokenParts[2];

      const isAttendanceQrTokenUUID = z
        .uuid()
        .safeParse(attendanceQrToken).success;

      if (!isAttendanceQrTokenUUID || !attendanceQrToken)
        throw new BadRequestException("Invalid token provided");

      const now = new Date();

      await db.transaction(async (tx) => {
        const [student] = await tx
          .select()
          .from(studentsTable)
          .where(eq(studentsTable.userId, user.id));

        if (!student) throw new ForbiddenException();

        const [event] = await tx
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.isActive, true),
              lte(eventsTable.startsAt, now),
              gt(eventsTable.endsAt, now),
              eq(eventsTable.attendanceQrToken, attendanceQrToken),
              eq(eventsTable.id, id),
            ),
          )
          .for("update");

        if (!event)
          throw new BadRequestException(
            "Event not found or is not ready for checkins",
          );

        const [participant] = await tx
          .select()
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.studentId, student.userId),
              eq(participantsTable.registrationStatus, "accepted"),
              eq(participantsTable.eventId, event.id),
              isNull(participantsTable.checkedOutAt),
            ),
          )
          .for("update");

        if (!participant)
          throw new BadRequestException(
            "You are not a valid participant for this party",
          );

        if (participant.checkedInAt !== null)
          throw new BadRequestException("You have already checked in once");

        await tx
          .update(participantsTable)
          .set({ checkedInAt: now })
          .where(
            and(
              eq(participantsTable.studentId, student.userId),
              eq(participantsTable.registrationStatus, "accepted"),
              eq(participantsTable.eventId, event.id),
              isNull(participantsTable.checkedInAt),
            ),
          );
      });

      return c.json({ eventId: id, status: "accepted" as const });
    },
  )
  .post(
    "/info",
    enforceAuthMiddleware(["teacher", "admin"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", z.object({ studentQrToken: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { studentQrToken } = c.req.valid("json");

      const tokenParts = studentQrToken.split(":");

      if (tokenParts[0] !== "qr" && tokenParts[1] !== "s")
        throw new BadRequestException("Invalid token format");

      const tokenUUID = tokenParts[2];
      const isTokenUUID = z.uuid().safeParse(tokenUUID).success;

      if (!tokenUUID || !isTokenUUID)
        throw new BadRequestException("Invalid student qr token provided");

      const [row] = await db
        .select({
          user: {
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            displayImageId: usersTable.displayImageId,
          },
          student: {
            department: studentsTable.department,
            batch: studentsTable.batch,
            studentId: studentsTable.studentId,
          },
          participant: participantsTable,
          volunteer: volunteersTable,
          team: teamsTable,
        })
        .from(studentsTable)
        .innerJoin(usersTable, eq(usersTable.id, studentsTable.userId))
        .leftJoin(
          participantsTable,
          and(
            eq(participantsTable.studentId, studentsTable.userId),
            eq(participantsTable.eventId, id),
            eq(participantsTable.registrationStatus, "accepted"),
          ),
        )
        .leftJoin(teamsTable, eq(participantsTable.teamId, teamsTable.id))
        .leftJoin(
          volunteersTable,
          and(
            eq(volunteersTable.studentId, studentsTable.userId),
            eq(volunteersTable.eventId, id),
            or(
              eq(volunteersTable.registrationStatus, "approved"),
              eq(volunteersTable.inviteStatus, "accepted"),
            ),
          ),
        )
        .where(and(eq(studentsTable.qrToken, tokenUUID)));

      if (!row)
        throw new BadRequestException("Student not found, Invalid QR Token");

      if (!row.participant && !row.volunteer)
        throw new BadRequestException(
          "Student is not a valid participant or volunteer in this event",
        );

      const result = {
        ...row.user,
        ...row.student,
        participant: { ...row.participant },
        team: { ...row.team },
        volunteer: { ...row.volunteer },
        eventCheckin: !!row.participant?.checkedInAt,
        volunteerCheckin: !!row.volunteer?.checkedInAt,
      };

      return c.json(result);
    },
  )
  .post(
    "/confirm",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    zValidator("json", z.object({ studentQrToken: z.string() })),
    zValidator(
      "query",
      z
        .object({
          volunteerCheckin: z.enum(["true", "false"]).optional(),
          participantCheckin: z.enum(["true", "false"]).default("true"),
        })
        .refine(
          (val) =>
            val.participantCheckin === "true" ||
            val.volunteerCheckin === "true",
          "Provide at least one check in type, volunteer and/or participant",
        ),
    ),

    async (c) => {
      const { id } = c.req.valid("param");
      const { studentQrToken } = c.req.valid("json");
      const { volunteerCheckin, participantCheckin } = c.req.valid("query");

      const token = verifyAndExtractQrToken(studentQrToken, "student");

      const now = new Date();

      const updated: string[] = [];

      const student = await db.transaction(async (tx) => {
        const [student] = await tx
          .select()
          .from(studentsTable)
          .where(eq(studentsTable.qrToken, token));

        if (!student) throw new BadRequestException("Student not found");

        if (participantCheckin && participantCheckin === "true") {
          const [participant] = await tx
            .select()
            .from(participantsTable)
            .where(
              and(
                eq(participantsTable.eventId, id),
                eq(participantsTable.studentId, student.userId),
                eq(participantsTable.registrationStatus, "accepted"),
              ),
            )
            .for("update");

          if (!participant)
            throw new BadRequestException("Student is not a valid participant");

          if (participant.checkedInAt !== null)
            throw new BadRequestException(
              "Student has already checked in before for this event",
            );

          const [updatedParticipant] = await tx
            .update(participantsTable)
            .set({ checkedInAt: now })
            .where(
              and(
                eq(participantsTable.eventId, id),
                eq(participantsTable.studentId, student.userId),
                eq(participantsTable.registrationStatus, "accepted"),
                isNull(participantsTable.checkedInAt),
              ),
            )
            .returning();

          if (!updatedParticipant)
            throw new BadRequestException(
              "Student has already checked in before for this event",
            );

          updated.push("participant");
        }

        if (volunteerCheckin && volunteerCheckin === "true") {
          const [volunteer] = await tx
            .select()
            .from(volunteersTable)
            .where(
              and(
                eq(volunteersTable.studentId, student.userId),
                eq(volunteersTable.eventId, id),
                or(
                  eq(volunteersTable.inviteStatus, "accepted"),
                  eq(volunteersTable.registrationStatus, "approved"),
                ),
              ),
            )
            .for("update");

          if (!volunteer)
            throw new BadRequestException(
              "Student is not a volunteer for this event",
            );

          if (volunteer.checkedInAt !== null)
            throw new BadRequestException(
              "Student has already checked in as a volunteer",
            );

          const [updatedVolunteer] = await tx
            .update(volunteersTable)
            .set({ checkedInAt: now })
            .where(
              and(
                eq(volunteersTable.studentId, student.userId),
                eq(volunteersTable.eventId, id),
                isNull(volunteersTable.checkedInAt),
                or(
                  eq(volunteersTable.inviteStatus, "accepted"),
                  eq(volunteersTable.registrationStatus, "approved"),
                ),
              ),
            )
            .returning();

          if (!updatedVolunteer)
            throw new BadRequestException(
              "Student has already checked in as a volunteer",
            );

          updated.push("volunteer");
        }

        return student;
      });

      return c.json({
        id: student.userId,
        status: "success" as const,
        updated,
      });
    },
  );

export default app;
