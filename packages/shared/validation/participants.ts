import z from "zod";

export const createParticipantSchema = z.object({
  eventId: z.uuid(),
});

export const updateParticipantSchema = z.object({
  registrationStatus: z.enum(["accepted", "rejected"]),
});
