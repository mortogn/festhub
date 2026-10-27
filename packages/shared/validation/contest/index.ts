import z from "zod";

const baseContestSchema = z.object({
  eventId: z.uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const createContestSchema = baseContestSchema.refine(
  (val) => val.endsAt > val.startsAt,
  "End date must be after start date",
);

export const updateContestSchema = baseContestSchema
  .extend({
    isActive: z.boolean().optional(),
    password: z.string().optional(),
  })
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
  title: z.string(),
  statement: z.string(),
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
  sourceCode: z.string(),
  languageCode: z.int().positive(),
});
