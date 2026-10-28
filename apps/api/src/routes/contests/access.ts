import { createHash } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import bcrypt from "bcrypt";
import { db, type DBClient } from "@festhub/db";
import { contestsTable } from "@festhub/db/schema";
import { and, eq } from "drizzle-orm";
import type { AppVars } from "../../types/variables.js";
import { AuthException } from "../../exceptions/auth-exception.js";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import { NotFoundException } from "../../exceptions/not-found-exception.js";
import { BadRequestException } from "../../exceptions/bad-request-exception.js";
import { throwOnNotAParticipant } from "./_helper.js";

export type Contest = typeof contestsTable.$inferSelect;
export type Participant = Awaited<
  ReturnType<typeof throwOnNotAParticipant>
> | null;
export type ContestAccessOptions = {
  dbClient?: DBClient;
  lock?: boolean;
  content?: boolean;
  skipPassword?: boolean;
};
export type ContestAccessResult = {
  contest: Contest;
  participant: Participant;
};
export type ContestAccessCheck = <E extends AppVars>(
  c: Context<E>,
  contestId: string,
  options?: ContestAccessOptions,
) => Promise<ContestAccessResult>;

export const isStaff = <E extends AppVars>(c: Context<E>) =>
  c.var.user.authenticated && ["teacher", "admin"].includes(c.var.user.role);
const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const cookieName = (id: string) => `contest_${id}`;
function secret() {
  if (!process.env.ACCESS_TOKEN_SECRET)
    throw new Error("ACCESS_TOKEN_SECRET must be set");
  return process.env.ACCESS_TOKEN_SECRET;
}

export async function hasContestAccess<E extends AppVars>(
  c: Context<E>,
  contest: Contest,
) {
  if (contest.kind !== "official" || isStaff(c) || !contest.password)
    return true;
  const user = c.var.user;
  const token = getCookie(c, cookieName(contest.id));
  if (!user.authenticated || !token) return false;
  try {
    const payload = await verify(token, secret(), "HS256");
    return (
      payload.iss === "festhub/contest" &&
      payload.sub === user.id &&
      payload.contestId === contest.id &&
      payload.passwordVersion === fingerprint(contest.password)
    );
  } catch {
    return false;
  }
}

export async function unlockContest<E extends AppVars>(
  c: Context<E>,
  contest: Contest,
  password: string,
) {
  const user = c.var.user;
  if (!user.authenticated) throw new AuthException();
  if (contest.kind !== "official" || !contest.password) return;
  if (!(await bcrypt.compare(password, contest.password)))
    throw new ForbiddenException("Incorrect contest password");
  const token = await sign(
    {
      iss: "festhub/contest",
      sub: user.id,
      contestId: contest.id,
      passwordVersion: fingerprint(contest.password),
      exp: Math.floor(Date.now() / 1000) + 604800,
    },
    secret(),
    "HS256",
  );
  setCookie(c, cookieName(contest.id), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/contests`,
    maxAge: 604800,
  });
}

export async function requireOfficialContestAccess<E extends AppVars>(
  c: Context<E>,
  contestId: string,
  options: ContestAccessOptions = {},
) {
  const user = c.var.user;
  if (!user.authenticated) throw new AuthException();
  const client = options.dbClient ?? db;
  const query = client
    .select()
    .from(contestsTable)
    .where(
      and(
        eq(contestsTable.id, contestId),
        eq(contestsTable.kind, "official"),
        ...(!isStaff(c) ? [eq(contestsTable.isActive, true)] : []),
      ),
    );
  const [contest] = await (options.lock ? query.for("update") : query);
  if (!contest) throw new NotFoundException("Contest not found");
  if (isStaff(c)) return { contest, participant: null };
  if (user.role !== "student") throw new ForbiddenException();
  const participant = await throwOnNotAParticipant({
    studentId: user.id,
    contestId,
    dbClient: client,
  });
  if (!options.skipPassword && !(await hasContestAccess(c, contest)))
    throw new ForbiddenException("Enter the contest password to continue");
  if (options.content !== false && contest.startsAt && contest.startsAt > new Date())
    throw new BadRequestException("Contest has not started yet");
  return { contest, participant };
}

export const requireContestAccess = requireOfficialContestAccess;

/**
 * Practice access covers problem sets and official contests after they end.
 * It intentionally never requires event registration or a contest password.
 */
export async function requirePracticeAccess<E extends AppVars>(
  c: Context<E>,
  contestId: string,
  options: { dbClient?: DBClient; lock?: boolean } = {},
) {
  const user = c.var.user;
  if (!user.authenticated) throw new AuthException();
  const client = options.dbClient ?? db;
  const query = client
    .select()
    .from(contestsTable)
    .where(eq(contestsTable.id, contestId));
  const [contest] = await (options.lock ? query.for("update") : query);
  if (!contest) throw new NotFoundException("Practice not found");
  if (isStaff(c)) return { contest, participant: null as Participant };

  if (user.role !== "student") throw new ForbiddenException();
  if (!contest.isActive) throw new NotFoundException("Practice not found");
  if (contest.kind === "official") {
    if (!contest.endsAt || contest.endsAt > new Date())
      throw new NotFoundException(
        "Practice is available after the contest ends",
      );
  }
  return { contest, participant: null as Participant };
}

export async function safeContest<E extends AppVars>(
  c: Context<E>,
  contest: Contest,
) {
  const { password, ...safe } = contest;
  return {
    ...safe,
    hasPassword: contest.kind === "official" && Boolean(password),
    isLocked: !(await hasContestAccess(c, contest)),
  };
}

export function requireEditableContest(contest: Contest, practice = false) {
  if (practice) return;
  if (contest.kind !== "official" || !contest.startsAt)
    throw new BadRequestException("Contest content cannot be edited");
  if (contest.startsAt <= new Date())
    throw new BadRequestException(
      "Problems and test cases cannot change after the contest starts",
    );
}
