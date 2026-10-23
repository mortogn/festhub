"use client";

import client from "@/lib/api";
import { useAuthContext } from "@/context/auth-user-context";
import { Button } from "@festhub/ui/components/button";
import { UsersIcon } from "@festhub/ui/icons";
import {
  MutationButton,
  ResourceContent,
  StatusBadge,
} from "@festhub/frontend/ui";
import { readResponse } from "@festhub/frontend/api";
import Link from "next/link";
import { useEventActivity } from "./event-activity";

type Props = { eventId: string; disabled: boolean };
export default function ParticipantRegisterButton({
  eventId,
  disabled,
}: Props) {
  const { user, status, retry } = useAuthContext();
  const { student } = useEventActivity();
  const existing = student.data?.events.find((event) => event.id === eventId);
  if (status === "loading")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading your account…
      </p>
    );
  if (status === "error")
    return (
      <div>
        <p role="alert" className="text-sm text-muted-foreground">
          Unable to load your account.
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  if (status === "unauthenticated")
    return (
      <Button asChild className="h-11 w-full" disabled={disabled}>
        <Link href="/sign-in">Sign in to participate</Link>
      </Button>
    );
  if (user?.role !== "student")
    return (
      <p className="text-sm text-muted-foreground">
        Registration is available to student accounts.
      </p>
    );
  return (
    <ResourceContent resource={student}>
      {existing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Your registration
            </span>
            <StatusBadge status={existing.joinStatus} />
          </div>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/profile">View your registrations</Link>
          </Button>
        </div>
      ) : (
        <MutationButton
          disabled={disabled}
          variant="default"
          className="h-11 w-full"
          action={async () =>
            readResponse(await client.participants.$post({ json: { eventId } }))
          }
          onSuccess={student.retry}
        >
          <UsersIcon />
          Join as a participant
        </MutationButton>
      )}
    </ResourceContent>
  );
}
