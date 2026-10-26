"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { CameraIcon, CameraOffIcon } from "@festhub/ui/icons";

export function QrScanner({
  onScan,
  paused = false,
}: {
  onScan: (value: string) => void;
  paused?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  const lastScan = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const inputId = useId();

  useEffect(() => { callback.current = onScan; }, [onScan]);

  useEffect(() => {
    const target = video.current;
    if (!enabled || paused || !target) return;
    let active = true;
    let controls: { stop: () => void } | undefined;
    let delivered = false;
    let absentSince: number | null = null;
    import("@zxing/browser")
      .then(async ({ BrowserQRCodeReader }) => {
        if (!active) return;
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
        });
        const scanner = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          target,
          (result) => {
            if (!active || delivered) return;
            const now = Date.now();
            if (!result) {
              absentSince ??= now;
              if (now - absentSince > 1500)
                lastScan.current = null;
              return;
            }
            absentSince = null;
            const value = result.getText().trim();
            const previous = lastScan.current;
            lastScan.current = value;
            if (!value || previous === value) return;
            delivered = true;
            callback.current(value);
          },
        );
        controls = scanner;
        if (!active) scanner.stop();
        else setCameraReady(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const denied = cause instanceof Error && cause.name === "NotAllowedError";
        setError(denied
          ? "Camera access was denied. Allow camera access in your browser, or paste the QR token below."
          : "Could not start the camera. Use HTTPS or localhost, check your camera, or paste the QR token below.");
        setEnabled(false);
        setCameraReady(false);
      });
    return () => {
      active = false;
      controls?.stop();
      const stream = target.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
      target.srcObject = null;
    };
  }, [enabled, paused]);

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-xs space-y-3">
        {enabled && (
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            <video ref={video} muted playsInline autoPlay aria-label="Student QR camera" className="size-full object-cover" />
            <p role="status" className="absolute inset-x-2 bottom-2 rounded bg-background/90 px-2 py-1 text-center text-xs">
              {paused ? "Scanning paused while you review" : cameraReady ? "Hold a student QR inside the camera" : "Starting camera…"}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={paused}
          onClick={() => {
            setError(null);
            setCameraReady(false);
            setEnabled((current) => !current);
          }}
        >
          {enabled ? <CameraOffIcon aria-hidden="true" /> : <CameraIcon aria-hidden="true" />}
          {enabled ? "Stop camera" : "Start camera"}
        </Button>
        {enabled && <p className="text-center text-xs text-muted-foreground">Move a QR out of view before scanning it again.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (paused || !token.trim()) return;
          callback.current(token.trim());
          setToken("");
        }}
      >
        <Label htmlFor={inputId}>Or paste a student QR token</Label>
        <div className="flex flex-wrap gap-2">
          <Input id={inputId} value={token} onChange={(event) => setToken(event.target.value)} placeholder="qr:s:…" autoComplete="off" spellCheck={false} disabled={paused} className="min-w-0 flex-1" />
          <Button type="submit" disabled={paused || !token.trim()}>Look up student</Button>
        </div>
      </form>
    </div>
  );
}
