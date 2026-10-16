import { z } from "zod";

const baseSignUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(32),
  name: z.string().min(3).max(50),
  department: z.string(),
});

const studentSignUpSchema = baseSignUpSchema.extend({
  role: z.literal("student"),
  studentId: z.number(),
  batch: z.number(),
  is_hsc: z.boolean().default(true),
});

const teacherSignUpSchema = baseSignUpSchema.extend({
  role: z.literal("teacher"),
  teacherId: z.number(),
});

const signUpSchema = z.discriminatedUnion("role", [
  studentSignUpSchema,
  teacherSignUpSchema,
]);

export { signUpSchema, studentSignUpSchema };
