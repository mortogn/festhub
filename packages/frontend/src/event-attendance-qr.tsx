"use client";

import { useRef, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@festhub/ui/components/dialog";
import { CopyIcon, QrCodeIcon } from "@festhub/ui/icons";
import client, { errorMessage, readResponse } from "./api";
import { QrCodePanel } from "./qr-code";

function checkInUrl(eventId: string, token: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_STUDENT_URL?.trim();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    window.location.hostname,
  );
  if (!configuredUrl && !local)
    throw new Error(
      "The student site URL has not been configured. Set NEXT_PUBLIC_STUDENT_URL for this app before sharing event QR codes.",
    );

  let origin: URL;
  try {
    origin = new URL(configuredUrl || "http://localhost:3000");
  } catch {
    throw new Error(
      "The student site URL is invalid. Check NEXT_PUBLIC_STUDENT_URL.",
    );
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password
  )
    throw new Error("The student site URL must be an HTTP or HTTPS URL.");

  const url = new URL(`/events/${encodeURIComponent(eventId)}/check-in`, origin);
  url.searchParams.set("token", token);
  return url.href;
}

export function EventAttendanceQr({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const requestId = useRef(0);

  async function copyUrl(value: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopyStatus("Check-in URL copied.");
    } catch {
      setCopyStatus("Select the URL below to copy it, or try Copy URL again.");
    }
  }

  async function load() {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    setUrl(null);
    setCopyStatus(null);
    try {
      // Validate the public student origin before requesting a QR token.
      checkInUrl(eventId, "");
      const result = await readResponse(
        await client.events[":id"].attendance.qr.$get({ param: { id: eventId } }),
      );
      if (request !== requestId.current) return;
      const value = checkInUrl(eventId, result.attendanceQrToken);
      setUrl(value);
      await copyUrl(value);
    } catch (error) {
      if (request === requestId.current) setError(errorMessage(error));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void load();
        else requestId.current++;
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <QrCodeIcon aria-hidden="true" />
          Event QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">
            {title} — Check-in QR
          </DialogTitle>
          <DialogDescription>
            Students scan this code with their camera to open the check-in
            confirmation page.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <p role="status" className="text-sm text-muted-foreground">
            Preparing event QR…
          </p>
        )}
        {error && (
          <div className="space-y-3">
            <p role="alert" className="text-sm break-words text-destructive">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        )}
        {url && (
          <div className="space-y-4">
            <QrCodePanel
              value={url}
              filename={`event-${eventId}-check-in`}
              label={`${title} check-in QR`}
            />
            <div className="space-y-2">
              <label
                htmlFor={`event-qr-url-${eventId}`}
                className="text-sm font-medium"
              >
                Check-in URL
              </label>
              <Input
                id={`event-qr-url-${eventId}`}
                value={url}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void copyUrl(url)}
              >
                <CopyIcon aria-hidden="true" />
                Copy URL
              </Button>
              {copyStatus && (
                <p role="status" className="text-xs text-muted-foreground">
                  {copyStatus}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
