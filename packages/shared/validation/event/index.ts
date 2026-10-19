import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(["workshop", "seminar", "contest"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const updateEventSchema = createEventSchema
  .extend({
    registrationOpensAt: z.coerce.date().optional(),
    registrationClosesAt: z.coerce.date().optional(),
    volunteerStartsAt: z.coerce.date().optional(),
    volunteerEndsAt: z.coerce.date().optional(),
    maxVolunteers: z.number().optional(),
    isActive: z.boolean().optional(),
    teamBased: z.boolean().optional(),
    maxTeamSize: z.number().optional(),
    minTeamSize: z.number().optional(),
    maxTeams: z.number().optional(),
    volunteerRegistration: z.enum(["open", "closed"]).optional(),
    maxParticipants: z.number().optional(),
  })
  .partial()
  .refine(
    (obj) => !Object.values(obj).every((val) => val === undefined),
    "Entire update object is empty",
  );
