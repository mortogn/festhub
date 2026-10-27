import { db, DBClient } from "@festhub/db";
import {
  participantsTable,
  eventsTable,
  contestsTable,
  teamsTable,
} from "@festhub/db/schema";
import { eq, and } from "drizzle-orm";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import { InternalServerErrorException } from "../../exceptions/internal-server-error-exception.js";
import { parseJudgeLimits, type JudgeLimits } from "@festhub/shared/contest";

type Params = {
  dbClient?: DBClient;
  studentId: string;
  contestId: string;
};

export async function throwOnNotAParticipant({
  studentId,
  contestId,
  dbClient = db,
}: Params) {
  const [row] = await dbClient
    .select({
      participant: participantsTable,
      teamBased: eventsTable.teamBased,
    })
    .from(participantsTable)
    .innerJoin(eventsTable, eq(eventsTable.id, participantsTable.eventId))
    .innerJoin(contestsTable, eq(contestsTable.eventId, eventsTable.id))
    .where(
      and(
        eq(participantsTable.studentId, studentId),
        eq(participantsTable.registrationStatus, "accepted"),
        eq(contestsTable.id, contestId),
      ),
    );

  if (!row) throw new ForbiddenException();

  if (row.teamBased) {
    if (!row.participant.teamId)
      throw new ForbiddenException("Accepted team registration is required");
    const [team] = await dbClient
      .select()
      .from(teamsTable)
      .where(
        and(
          eq(teamsTable.id, row.participant.teamId),
          eq(teamsTable.eventId, row.participant.eventId),
          eq(teamsTable.status, "accepted"),
        ),
      );
    if (!team)
      throw new ForbiddenException("Accepted team registration is required");
  }

  return {
    ...row.participant,
    teamId: row.teamBased ? row.participant.teamId : null,
  };
}

let languagesCache:
  | { expiresAt: number; data: Array<{ id: number; name: string }> }
  | undefined;
export async function getJudgeLanguages() {
  if (languagesCache && languagesCache.expiresAt > Date.now())
    return languagesCache.data;
  const JUDGE_URL = process.env.JUDGE0_URL?.replace(/\/$/, "");
  const JUDGE_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;
  if (!JUDGE_URL || !JUDGE_AUTH_TOKEN)
    throw new Error("JUDGE0_URL and JUDGE0_AUTH_TOKEN must be set");
  const response = await fetch(`${JUDGE_URL}/languages`, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "X-AUTH-TOKEN": JUDGE_AUTH_TOKEN!,
    },
  });

  if (!response.ok)
    throw new InternalServerErrorException(
      "Failed to fetch languages from judge service",
    );

  const data = await response.json();

  const languages = data as Array<{ id: number; name: string }>;
  languagesCache = { data: languages, expiresAt: Date.now() + 300000 };
  return languages;
}

let limitsCache: { expiresAt: number; data: JudgeLimits } | undefined;
export async function getJudgeLimits() {
  if (limitsCache && limitsCache.expiresAt > Date.now())
    return limitsCache.data;
  const url = process.env.JUDGE0_URL?.replace(/\/$/, "");
  const token = process.env.JUDGE0_AUTH_TOKEN;
  if (!url || !token)
    throw new Error("JUDGE0_URL and JUDGE0_AUTH_TOKEN must be set");
  const response = await fetch(`${url}/config_info`, {
    headers: { "X-Auth-Token": token },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new InternalServerErrorException("Failed to fetch judge limits");
  const limits = parseJudgeLimits(await response.json());
  limitsCache = { expiresAt: Date.now() + 300000, data: limits };
  return limits;
}
