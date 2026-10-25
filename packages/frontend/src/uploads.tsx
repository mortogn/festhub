import type { InferRequestType, InferResponseType } from "hono";
import { presignSchema } from "@festhub/shared/validation";
import client, { errorMessage, readResponse } from "./api";

type PresignRequest = InferRequestType<
  typeof client.upload.presign.$post
>["json"];
type PresignResponse = InferResponseType<
  typeof client.upload.presign.$post,
  200
>;
export type UploadTarget =
  | { type: "avatar"; resourceId?: never }
  | {
      type: "event_banner" | "event_thumbnail" | "venue_thumbnail";
      resourceId: string;
    };
export type UploadStage =
  "presigning" | "uploading" | "confirming" | "checking";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function imageUrl(id: string) {
  return client.upload[":id"].url.$url({ param: { id } }).href;
}

export function validateImage(file: File, target: UploadTarget) {
  if (!file.size) throw new Error("Choose a nonempty image file.");
  if (file.size > 10_000_000)
    throw new Error("Maximum allowed file size is 10MB (10,000,000 bytes).");
  if (!IMAGE_ACCEPT.split(",").includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  const result = presignSchema.safeParse({
    ...target,
    size: file.size,
    contentType: file.type,
  });
  if (!result.success) {
    throw new Error("Save the event or venue before uploading its image.");
  }
  return result.data;
}

async function currentImageId(target: UploadTarget) {
  if (target.type === "avatar")
    return (await readResponse(await client.users.self.$get())).displayImageId;
  if (target.type === "venue_thumbnail") {
    const venues = await readResponse(await client.venues.$get());
    return venues.find((venue) => venue.id === target.resourceId)?.thumbnailId;
  }
  const event = await readResponse(
    await client.events[":id"].$get({ param: { id: target.resourceId } }),
  );
  return target.type === "event_banner" ? event.bannerId : event.thumbnailId;
}

export async function uploadImage(
  file: File,
  target: UploadTarget,
  onStage: (stage: UploadStage) => void,
) {
  const json: PresignRequest = validateImage(file, target);
  onStage("presigning");
  let presign: PresignResponse;
  try {
    presign = await readResponse(await client.upload.presign.$post({ json }));
  } catch (error) {
    throw new Error(`Could not prepare the upload. ${errorMessage(error)}`);
  }

  // The API's expiresIn field contains an absolute timestamp, not a duration.
  if (presign.expiresIn && Date.parse(presign.expiresIn) <= Date.now())
    throw new Error("The upload link expired. Please try again.");

  onStage("uploading");
  const form = new FormData();
  for (const [name, value] of Object.entries(presign.fields)) {
    if (typeof value !== "string")
      throw new Error(
        "The server returned invalid upload fields. Please try again.",
      );
    form.append(name, value);
  }
  // S3 requires the file field last. The browser supplies the multipart boundary.
  form.append("file", file);
  try {
    const response = await fetch(presign.url, {
      method: "POST",
      credentials: "omit",
      body: form,
    });
    if (!response.ok)
      throw new Error(`Storage returned HTTP ${response.status}.`);
  } catch (error) {
    throw new Error(
      `Could not upload the image. ${errorMessage(error)} Please try again.`,
    );
  }

  onStage("confirming");
  try {
    return await readResponse(
      await client.upload[":id"].confirm.$put({ param: { id: presign.id } }),
    );
  } catch (error) {
    // Confirmation isn't idempotent. Check the resource instead of resending it
    // when the server may have committed before its response was lost.
    onStage("checking");
    try {
      if ((await currentImageId(target)) === presign.id)
        return { id: presign.id, status: "accepted" as const };
    } catch {
      throw new Error(
        "Could not verify whether the image was saved. Reload this page before trying again.",
      );
    }
    throw new Error(
      `Could not confirm the image. ${errorMessage(error)} Please try again.`,
    );
  }
}

let imageSessionCheck: Promise<boolean> | null = null;
export function refreshImageSession() {
  if (!imageSessionCheck) {
    imageSessionCheck = client.users.self
      .$get()
      .then(readResponse)
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        imageSessionCheck = null;
      });
  }
  return imageSessionCheck;
}
