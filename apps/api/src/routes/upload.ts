import { Hono } from "hono";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import { zValidator } from "@hono/zod-validator";
import { presignSchema } from "@festhub/shared/validation";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { s3Client, storage } from "../lib/s3-client.js";
import { db } from "@festhub/db";
import {
  eventsTable,
  uploadsTable,
  usersTable,
  venuesTable,
} from "@festhub/db/schema";
import { ForbiddenException } from "../exceptions/forbidden-exception.js";
import { randomUUID } from "node:crypto";
import dayjs from "dayjs";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import z from "zod";
import { and, eq } from "drizzle-orm";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import {
  Bucket$,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { AppVars, Variables } from "../types/variables.js";
import { AuthException } from "../exceptions/auth-exception.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NotFoundException } from "../exceptions/not-found-exception.js";
import { throwDeprecation } from "node:process";
import { HTTPException } from "hono/http-exception";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const TYPE_TO_PREFIX: Record<string, string> = {
  avatar: "avatars",
  event_banner: "events/banners",
  event_thumbnail: "events/thumbnails",
  venue_thumbnail: "venues/thumbnails",
};

async function getUploadPresignedURL({
  key,
  expireInSeconds,
  contentType,
}: {
  key: string;
  expireInSeconds: number;
  contentType: string;
}) {
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: process.env.AWS_S3_BUCKET_NAME as string,
    Key: key,
    Conditions: [
      { bucket: process.env.AWS_S3_BUCKET_NAME! },
      ["starts-with", "$Content-Type", "image/"],
      ["content-length-range", 1, 10_000_000],
    ],
    Expires: expireInSeconds,
    Fields: {
      "Content-Type": contentType,
    },
  });

  return { url, fields };
}

function handleS3Error(error: unknown) {
  if (error instanceof S3ServiceException) {
    const httpCode = error.$metadata.httpStatusCode;

    if (httpCode === 412 || error.name === "PreconditionFailed") {
      throw new HTTPException(409, {
        message: "Upload was modified. Please upload the file again.",
      });
    }

    if (httpCode === 404) {
      throw new HTTPException(404, {
        message: "Uploaded file was not found.",
      });
    }

    if (httpCode === 409) {
      throw new HTTPException(409, {
        message: "Upload conflict. Please upload the file again.",
      });
    }
  }
}

const app = new Hono<AppVars>()
  .post(
    "/presign",
    enforceAuthMiddleware(),
    zValidator("json", presignSchema),
    async (c) => {
      const user = c.var.user;
      const body = c.req.valid("json");

      if (body.type !== "avatar" && user.role === "student")
        throw new ForbiddenException();

      if (body.type !== "avatar" && body.resourceId) {
        if (body.type === "venue_thumbnail") {
          const [venue] = await db
            .select({ id: venuesTable.id })
            .from(venuesTable)
            .where(eq(venuesTable.id, body.resourceId));

          if (!venue) throw new BadRequestException("Resource does not exists");
        }

        if (body.type.startsWith("event")) {
          const [event] = await db
            .select({ id: eventsTable.id })
            .from(eventsTable)
            .where(eq(eventsTable.id, body.resourceId));

          if (!event) throw new BadRequestException("Resource does not exists");
        }
      }

      const ext = MIME_TO_EXT[body.contentType];
      const prefix = TYPE_TO_PREFIX[body.type];

      const id = randomUUID();

      const tempKey = `temp/${user.id}/${id}.${ext}`;
      const key = `${prefix}/${id}.${ext}`;

      const { url, fields } = await getUploadPresignedURL({
        key: tempKey,
        expireInSeconds: 60 * 15,
        contentType: body.contentType,
      });

      const [upload] = await db
        .insert(uploadsTable)
        .values({
          id: id,
          ownerId: user.id,
          expiresAt: dayjs().add(15, "minute").toDate(),
          temporaryKey: tempKey,
          key: key,
          expectedSize: body.size,
          status: "pending",
          type: body.type,
          contentType: body.contentType,
          resourceId: body.resourceId,
        })
        .returning();

      if (!upload) throw new InternalServerErrorException();

      return c.json({
        id: upload.id,
        url: url,
        expiresIn: upload.expiresAt,
        fields: fields,
      });
    },
  )
  .put(
    "/:id/confirm",
    enforceAuthMiddleware(),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const user = c.var.user;

      const [upload] = await db
        .select()
        .from(uploadsTable)
        .where(
          and(
            eq(uploadsTable.ownerId, user.id),
            eq(uploadsTable.status, "pending"),
            eq(uploadsTable.id, id),
          ),
        );

      if (!upload) throw new BadRequestException("Upload not found");

      const rejectUpload = async () => {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: storage.bucket,
            Key: upload.temporaryKey,
          }),
        );

        await db
          .update(uploadsTable)
          .set({
            status: "rejected",
          })
          .where(eq(uploadsTable.id, upload.id));
      };

      let head: HeadObjectCommandOutput;

      try {
        head = await s3Client.send(
          new HeadObjectCommand({
            Bucket: storage.bucket,
            Key: upload.temporaryKey,
          }),
        );

        if (
          head.ContentLength === undefined ||
          head.ContentType !== upload.contentType ||
          head.ContentLength !== upload.expectedSize ||
          head.ContentLength > 10_000_000
        ) {
          await rejectUpload();
          throw new BadRequestException("Uploaded file does not match policy");
        }
      } catch (err) {
        if (
          err instanceof S3ServiceException &&
          err.$metadata.httpStatusCode === 404
        )
          throw new BadRequestException("File has not been uploaded yet");

        throw err;
      }

      // let result: HeadObjectCommandOutput;

      try {
        const result = await s3Client.send(
          new GetObjectCommand({
            Bucket: storage.bucket,
            Key: upload.temporaryKey,
            Range: "bytes=0-4095",
            IfMatch: head.ETag,
          }),
        );

        const bytes = await result.Body?.transformToByteArray();

        const detected = bytes ? await fileTypeFromBuffer(bytes) : undefined;

        if (detected?.mime !== upload.contentType) {
          await rejectUpload();
          throw new BadRequestException("Invalid image content");
        }
      } catch (err) {
        handleS3Error(err);
        throw err;
      }

      try {
        await s3Client.send(
          new CopyObjectCommand({
            Bucket: storage.bucket,
            CopySource: `${storage.bucket}/${upload.temporaryKey}`,
            Key: upload.key,
            CopySourceIfMatch: head.ETag,
          }),
        );
      } catch (err) {
        handleS3Error(err);
        throw err;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(uploadsTable)
          .set({
            status: "accepted",
            actualSize: head.ContentLength,
            confirmedAt: new Date(),
          })
          .where(eq(uploadsTable.id, upload.id));

        if (upload.type === "avatar") {
          await tx
            .update(usersTable)
            .set({ displayImageId: upload.id })
            .where(eq(usersTable.id, upload.ownerId));
        }

        if (upload.type === "venue_thumbnail" && upload.resourceId) {
          await tx
            .update(venuesTable)
            .set({ thumbnailId: upload.id })
            .where(eq(venuesTable.id, upload.resourceId));
        }

        if (upload.type.startsWith("event") && upload.resourceId) {
          await tx
            .update(eventsTable)
            .set(
              upload.type === "event_banner"
                ? { bannerId: upload.id }
                : { thumbnailId: upload.id },
            )
            .where(eq(eventsTable.id, upload.resourceId));
        }
      });

      // Do not force failure when delete file is failed
      // Later cron job can delete the file that wasn't deleted because of aws api failure
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: storage.bucket,
            Key: upload.temporaryKey,
          }),
        );
      } catch {}

      return c.json({
        id: upload.id,
        status: "accepted" as const,
      });
    },
  )
  .get(
    "/:id/url",
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const user = c.var.user;

      const [upload] = await db
        .select()
        .from(uploadsTable)
        .where(
          and(eq(uploadsTable.id, id), eq(uploadsTable.status, "accepted")),
        );

      if (!upload) throw new NotFoundException();

      if (upload?.type === "avatar" && !user.authenticated)
        throw new AuthException();

      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: storage.bucket,
          Key: upload?.key,
        }),
      );

      return c.redirect(url);
    },
  );

export default app;
