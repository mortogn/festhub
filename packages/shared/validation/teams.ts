import z from "zod";

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Team name must contain at least 1 character" })
    .max(30, { error: "Team name at most can contain 30 characters" }),
  eventId: z.uuid(),
});

export const teamMemberInviteSchema = z.object({
  studentId: z.string(),
  teamId: z.string(),
});
