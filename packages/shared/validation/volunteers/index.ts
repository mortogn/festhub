import z from "zod";

export const baseVolunteerSchema = z.object({
  eventId: z.uuid(),
});

export const inviteVolunteerSchema = baseVolunteerSchema.extend({
  studentId: z.uuid(),
});

export const registerVolunteerSchema = baseVolunteerSchema;
