"use client";

import { useEffect, useState } from "react";
import client from "@/lib/api";
import { errorMessage, readResponse } from "@festhub/frontend/api";
import { QrCodePanel } from "@festhub/frontend/qr-code";
import { Button } from "@festhub/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@festhub/ui/components/dialog";
import { RotateCwIcon } from "@festhub/ui/icons";

function MyQrContent() {
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await readResponse(await client.students.self.qr.$get());
        if (active) setToken(result.qrToken);
      } catch (error) {
        if (active) setError(errorMessage(error));
      } finally {
        if (active) setPending(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  async function rotate() {
    setPending(true);
    setRotating(true);
    setError(null);
    setToken(null);
    try {
      const result = await readResponse(
        await client.students.self.qr.rotate.$patch(),
      );
      setToken(result.qrToken);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
      setRotating(false);
    }
  }

  return (
    <DialogContent
      showCloseButton={!rotating}
      onEscapeKeyDown={(event) => {
        if (rotating) event.preventDefault();
      }}
      onPointerDownOutside={(event) => {
        if (rotating) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>My QR</DialogTitle>
        <DialogDescription>
          Show this QR to event staff to check in. Keep it private.
        </DialogDescription>
      </DialogHeader>
      {pending && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          {rotating ? "Rotating your QR…" : "Loading your QR…"}
        </p>
      )}
      {token && (
        <QrCodePanel
          value={token}
          filename="festhub-my-qr"
          label="Your student check-in QR"
        />
      )}
      {error && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setToken(null);
              setPending(true);
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending || !token}
          onClick={rotate}
        >
          <RotateCwIcon aria-hidden="true" />
          Rotate QR
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Rotating makes your previous QR stop working.
        </p>
      </div>
    </DialogContent>
  );
}

export default function MyQrDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <MyQrContent key={userId} />}
    </Dialog>
  );
}
