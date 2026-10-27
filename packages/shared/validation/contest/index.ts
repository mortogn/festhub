import z from "zod";

const contestPasswordSchema = z
  .string()
  .min(1)
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Contest password must not exceed 72 UTF-8 bytes",
  );
const baseContestSchema = z.object({
  eventId: z.uuid(),
  title: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allowedLanguages: z.array(z.int().positive()).min(1).nullable().optional(),
  password: contestPasswordSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createContestSchema = baseContestSchema.refine(
  (val) => val.endsAt > val.startsAt,
  "End date must be after start date",
);

export const updateContestSchema = baseContestSchema
  .partial()
  .superRefine((val, ctx) => {
    if (val.startsAt && val.endsAt && val.endsAt <= val.startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be after start date",
      });
    }

    if (Object.values(val).every((v) => v === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "Entire contest update object is empty",
      });
    }
  });

export const createProblemSchema = z.object({
  title: z.string().trim().min(1),
  statement: z.string().trim().min(1),
  cpuLimit: z.int().positive(),
  memoryLimit: z.int().positive(),
});

export const createTestCaseSchema = z.object({
  stdin: z.string(),
  stdout: z.string(),
  isSample: z.boolean().default(false),
  position: z.int().positive(),
});

export const problemSubmissionSchema = z.object({
  sourceCode: z
    .string()
    .refine((value) => value.trim().length > 0, "Source code is empty")
    .refine(
      (value) => new TextEncoder().encode(value).length <= 65536,
      "Source code must not exceed 64 KiB",
    ),
  languageCode: z.int().positive(),
});

export const unlockContestSchema = z.object({
  password: contestPasswordSchema,
});
