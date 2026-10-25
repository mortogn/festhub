import z from "zod";

export const presignSchema = z
  .object({
    type: z.enum([
      "event_banner",
      "event_thumbnail",
      "avatar",
      "venue_thumbnail",
    ]),
    size: z
      .int()
      .positive()
      .max(10_000_000, "Maximum allowed file size is 10MB"),
    contentType: z.enum(
      ["image/jpeg", "image/png", "image/webp"],
      "File type must be of PNG, Webp or JPG",
    ),
    resourceId: z.uuid().optional(),
  })
  .refine(
    (val) =>
      val.type === "avatar"
        ? val.resourceId === undefined
        : val.resourceId !== undefined,
    "Resource id is missing",
  );
