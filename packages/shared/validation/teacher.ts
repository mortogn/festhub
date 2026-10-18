import z from "zod";

export const teacherInviteSchema = z.object({
  email: z.email(),
});
