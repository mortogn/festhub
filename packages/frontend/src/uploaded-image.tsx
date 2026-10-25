"use client";

import { useRef, useState, type ReactNode } from "react";
import { imageUrl, refreshImageSession } from "./uploads";

export function UploadedImage({
  imageId,
  alt,
  className = "aspect-video w-full rounded-lg",
  fallback,
  avatar = false,
}: {
  imageId?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  avatar?: boolean;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden bg-muted ${className}`}
    >
      <ImageContent
        key={imageId ?? "empty"}
        imageId={imageId}
        alt={alt}
        avatar={avatar}
        fallback={fallback}
      />
    </span>
  );
}

function ImageContent({
  imageId,
  alt,
  fallback,
  avatar,
}: {
  imageId?: string | null;
  alt: string;
  fallback?: ReactNode;
  avatar: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  if (!imageId || failed)
    return (
      <span className="flex size-full items-center justify-center text-sm text-muted-foreground">
        {fallback ?? <span className="sr-only">{alt}</span>}
      </span>
    );
  return (
    // Browser requests preserve API cookies; Next's image optimizer does not.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${imageUrl(imageId)}${attempt ? `?retry=${attempt}` : ""}`}
      alt={alt}
      className="absolute inset-0 size-full object-cover"
      loading="lazy"
      onError={async () => {
        if (avatar && !retried.current) {
          retried.current = true;
          if (await refreshImageSession()) {
            setAttempt(1);
            return;
          }
        }
        setFailed(true);
      }}
    />
  );
}

export function UploadedAvatar({
  imageId,
  name,
  className = "size-10",
}: {
  imageId?: string | null;
  name: string;
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "F";
  return (
    <UploadedImage
      imageId={imageId}
      alt={name}
      avatar
      className={`rounded-full text-xs font-semibold ${className}`}
      fallback={initials}
    />
  );
}
