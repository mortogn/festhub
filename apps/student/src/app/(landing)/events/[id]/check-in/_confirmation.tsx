"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import client from "@/lib/api";
import { useAuthContext } from "@/context/auth-user-context";
import { ApiError, errorMessage, readResponse } from "@festhub/frontend/api";
import { Button } from "@festhub/ui/components/button";
import { CheckCircle2Icon } from "@festhub/ui/icons";

export default function CheckInConfirmation({
  eventId,
  token,
}: {
  eventId: string;
  token: string;
}) {
  const { user, status, error: authError, retry } = useAuthContext();
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const returnTo = `/events/${eventId}/check-in?token=${encodeURIComponent(token)}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(returnTo)}`;

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await readResponse(
        await client.events[":id"].attendance.self.$post({
          param: { id: eventId },
          json: { qrToken: token },
        }),
      );
      setConfirmed(true);
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 401
          ? "Your session has expired. Sign in again to check in."
          : errorMessage(error),
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (confirmed) {
    return (
      <div role="status" className="space-y-3 rounded-md border border-border bg-muted/40 p-5">
        <CheckCircle2Icon aria-hidden="true" className="size-7 text-primary" />
        <h2 className="text-lg font-semibold">You’re checked in</h2>
        <p className="text-sm text-muted-foreground">
          Your attendance has been confirmed. Enjoy the event!
        </p>
        <Button asChild variant="secondary">
          <Link href={`/events/${eventId}`}>View event</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-border pt-6" aria-busy={pending}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Ready to check in?</h2>
        <p className="text-sm text-muted-foreground">
          Confirm your arrival below. You need an accepted participant
          registration, and the event must be open for check-in.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {status === "loading" && (
        <p role="status" className="text-sm text-muted-foreground">Loading your account…</p>
      )}
      {status === "error" && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {authError || "Unable to load your account."}
          </p>
          <Button variant="outline" onClick={retry}>Try again</Button>
        </div>
      )}
      {status === "unauthenticated" && (
        <Button asChild className="w-full">
          <Link href={signInHref}>Sign in to check in</Link>
        </Button>
      )}
      {status === "authenticated" && user?.role === "student" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checking in as <span className="font-medium text-foreground">{user.name}</span>
          </p>
          <Button className="w-full" disabled={pending} onClick={confirm}>
            {pending ? "Checking in…" : "Confirm check-in"}
          </Button>
        </div>
      )}
      {status === "authenticated" && user?.role !== "student" && (
        <p role="alert" className="text-sm text-destructive">
          Self check-in is available to student accounts. Sign out using the
          account menu and sign in with your student account.
        </p>
      )}
    </div>
  );
}
