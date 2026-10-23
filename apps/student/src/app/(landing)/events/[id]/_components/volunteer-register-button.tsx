"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthContext } from "@/context/auth-user-context";
import client from "@/lib/api";
import { Button } from "@festhub/ui/components/button";
import {
  MutationButton,
  ResourceContent,
  StatusBadge,
} from "@festhub/frontend/ui";
import { readResponse } from "@festhub/frontend/api";
import { useEventActivity } from "./event-activity";

export default function VolunteerRegisterButton({
  eventId,
  open,
  endsAt,
}: {
  eventId: string;
  open: boolean;
  endsAt: string;
}) {
  const { user, status, retry } = useAuthContext();
  const { student } = useEventActivity();
  const [now] = useState(() => Date.now());
  const existing = student.data?.volunteerEvents.find(
    (event) => event.id === eventId,
  );
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
      <Button asChild className="h-11 w-full">
        <Link href="/sign-in">Sign in to volunteer</Link>
      </Button>
    );
  if (user?.role !== "student")
    return (
      <p className="text-sm text-muted-foreground">
        Volunteering is available to student accounts.
      </p>
    );
  return (
    <ResourceContent resource={student}>
      {existing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {existing.volunteerType === "invited"
                ? "Your invitation"
                : "Your application"}
            </span>
            <StatusBadge status={existing.volunteerStatus} />
          </div>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/profile/volunteering">View volunteering</Link>
          </Button>
        </div>
      ) : (
        <MutationButton
          variant="default"
          className="h-11 w-full"
          disabled={!open || new Date(endsAt).getTime() <= now}
          action={async () =>
            readResponse(
              await client.volunteers.register.$post({ json: { eventId } }),
            )
          }
          onSuccess={student.retry}
        >
          Apply as a volunteer
        </MutationButton>
      )}
    </ResourceContent>
  );
}
