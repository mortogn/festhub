import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(["workshop", "seminar", "contest"]),
  startsAt: z.date(),
  endsAt: z.date(),
});

export const updateEventSchema = createEventSchema
  .extend({
    registrationOpensAt: z.date().optional(),
    registrationClosesAt: z.date().optional(),
    volunteerStartsAt: z.date().optional(),
    volunteerEndsAt: z.date().optional(),
    maxVolunteers: z.number().optional(),
    isActive: z.boolean().optional(),
    teamBased: z.boolean().optional(),
    maxTeamSize: z.number().optional(),
    minTeamSize: z.number().optional(),
    maxTeams: z.number().optional(),
  })
  .partial()
  .refine(
    (obj) => !Object.values(obj).every((val) => val === undefined),
    "Entire update object is empty",
  );

export const addVolunteerSchema = z.object({
  studentId: z.uuid(),
});
