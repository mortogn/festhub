"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { imageUrl, refreshImageSession } from "@festhub/frontend/uploads";
import { cn } from "@festhub/ui/lib/utils";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "F";

export function UserAvatar({
  name,
  imageId,
  className,
}: {
  name: string;
  imageId?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      <AvatarContent key={imageId ?? "empty"} name={name} imageId={imageId} />
    </span>
  );
}

function AvatarContent({
  name,
  imageId,
}: {
  name: string;
  imageId?: string | null;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  if (!imageId || failed)
    return (
      <>
        <span aria-hidden>{initialsOf(name)}</span>
        <span className="sr-only">{name}</span>
      </>
    );
  return (
    // Avatars need the API session cookie, which Next's server-side optimizer
    // cannot forward, so the browser loads the image directly.
    <Image
      unoptimized
      fill
      sizes="28px"
      src={`${imageUrl(imageId)}${attempt ? `?retry=${attempt}` : ""}`}
      alt={name}
      className="object-cover"
      onError={async () => {
        if (!retried.current) {
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
