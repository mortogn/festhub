import z from "zod";

export const createVenueSchema = z.object({
  title: z.string().min(1).max(55),
  description: z.string().optional(),
  type: z.enum(["LAB", "seminar", "classroom", "auditorium"]),
  capacity: z.number(),
});

export const updateVenueSchema = createVenueSchema
  .partial()
  .refine(
    (val) =>
      !Object.values(val).every(
        () => val === undefined,
        "Entire update object can not be empty",
      ),
  );
