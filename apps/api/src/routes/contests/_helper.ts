import { db, DBClient } from "@festhub/db";
import {
  participantsTable,
  eventsTable,
  contestsTable,
} from "@festhub/db/schema";
import { eq, and } from "drizzle-orm";
import { ForbiddenException } from "../../exceptions/forbidden-exception.js";
import { InternalServerErrorException } from "../../exceptions/internal-server-error-exception.js";

const JUDGE_URL = process.env.JUDGE0_URL;
const JUDGE_AUTH_TOKEN = process.env.JUDGE0_AUTH_TOKEN;

if (!JUDGE_URL || !JUDGE_AUTH_TOKEN) {
  throw new Error("JUDGE0_URL and JUDGE0_AUTH_TOKEN must be set");
}

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

  return row.participant;
}

export async function getJudgeLanguages() {
  const response = await fetch(`${JUDGE_URL}/languages`, {
    headers: {
      "X-AUTH-TOKEN": JUDGE_AUTH_TOKEN!,
    },
  });

  if (!response.ok)
    throw new InternalServerErrorException(
      "Failed to fetch languages from judge service",
    );

  const data = await response.json();

  return data as Array<{ id: number; name: string }>;
}
