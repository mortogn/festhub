"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { toast } from "@festhub/ui/components/sonner";
import { errorMessage } from "./api";
import { useToastFeedback } from "./notifications";
import { UploadedImage } from "./uploaded-image";
import {
  IMAGE_ACCEPT,
  uploadImage,
  validateImage,
  type UploadStage,
  type UploadTarget,
} from "./uploads";

const stageLabels: Record<UploadStage, string> = {
  presigning: "Preparing upload…",
  uploading: "Uploading image…",
  confirming: "Confirming image…",
  checking: "Checking whether the image was saved…",
};

export function ImageUpload({
  target,
  currentImageId,
  label,
  onUploaded,
  onBusyChange,
}: {
  target: UploadTarget;
  currentImageId?: string | null;
  label: string;
  onUploaded?: (id: string) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputId = useId();
  const feedbackId = `${inputId}-feedback`;
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const toastFeedback = useToastFeedback();
  const [selection, setSelection] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const file = selection?.file ?? null;
  const [saved, setSaved] = useState<{
    source: typeof currentImageId;
    id: string;
  } | null>(null);
  const savedId =
    saved && saved.source === currentImageId ? saved.id : currentImageId;
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const avatar = target.type === "avatar";

  useEffect(() => {
    return () => {
      if (selection) URL.revokeObjectURL(selection.url);
    };
  }, [selection]);

  async function submit() {
    if (!file || locked.current) return;
    locked.current = true;
    onBusyChange?.(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await uploadImage(file, target, setStage);
      setSaved({ source: currentImageId, id: result.id });
      setSelection(null);
      if (input.current) input.current.value = "";
      setSuccess(true);
      if (toastFeedback) toast.success(`${label} saved.`);
      try {
        await onUploaded?.(result.id);
      } catch {
        // The image was already accepted; a refresh error must not imply failure.
        const message = `${label} saved. Reload the page to refresh your account information.`;
        setError(message);
        if (toastFeedback) toast.warning(message);
      }
    } catch (error) {
      const message = errorMessage(error);
      setError(message);
      if (toastFeedback) toast.error(message);
    } finally {
      setStage(null);
      locked.current = false;
      onBusyChange?.(false);
    }
  }

  const previewUrl = selection?.url;
  const imageClass = avatar
    ? "size-24 rounded-full"
    : "aspect-video w-full rounded-lg";
  return (
    <div className="min-w-0 space-y-3" aria-busy={stage !== null}>
      <Label htmlFor={inputId}>{label}</Label>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`${label} preview (not saved)`}
          className={`object-cover ${imageClass}`}
        />
      ) : (
        <UploadedImage
          imageId={savedId}
          alt={label}
          avatar={avatar}
          className={imageClass}
          fallback="No image"
        />
      )}
      <Input
        ref={input}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={stage !== null}
        aria-describedby={`${inputId}-help ${feedbackId}`}
        aria-invalid={!!error}
        className="min-w-0 file:mr-3"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          setError(null);
          setSuccess(false);
          setSelection(null);
          if (!selected) return;
          try {
            validateImage(selected, target);
            setSelection({
              file: selected,
              url: URL.createObjectURL(selected),
            });
          } catch (error) {
            setError(errorMessage(error));
            event.target.value = "";
          }
        }}
      />
      <p id={`${inputId}-help`} className="text-xs text-muted-foreground">
        JPEG, PNG, or WebP. Maximum 10MB. Select a file, then upload to save it.
      </p>
      {file && (
        <p className="break-all text-xs text-muted-foreground">
          Selected: {file.name} · {(file.size / 1_000_000).toFixed(2)} MB
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={submit}
          disabled={!file || stage !== null}
        >
          {stage
            ? stageLabels[stage]
            : savedId
              ? `Replace ${label.toLowerCase()}`
              : `Upload ${label.toLowerCase()}`}
        </Button>
        {file && (
          <Button
            type="button"
            variant="ghost"
            disabled={stage !== null}
            onClick={() => {
              setSelection(null);
              setError(null);
              if (input.current) input.current.value = "";
            }}
          >
            Clear selection
          </Button>
        )}
      </div>
      <div id={feedbackId} aria-live="polite">
        {stage && (
          <p role="status" className="text-sm text-muted-foreground">
            {stageLabels[stage]}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {success && !error && (
          <p role="status" className="text-sm text-muted-foreground">
            {label} saved.
          </p>
        )}
      </div>
    </div>
  );
}
