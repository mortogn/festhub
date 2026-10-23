"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@festhub/ui/components/popover";
import { BellIcon, HandHeartIcon, UsersIcon } from "@festhub/ui/icons";
import type { Resource } from "@festhub/frontend/resource";
import { useAuthContext } from "@/context/auth-user-context";
import { useStudentData } from "@/context/student-data-context";

function InvitationGroup({
  title,
  resource,
  children,
}: {
  title: string;
  resource: Resource<unknown>;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {resource.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking invitations…
        </p>
      )}
      {resource.error && (
        <div className="space-y-1">
          <p role="status" className="text-xs text-muted-foreground">
            {resource.data !== null
              ? "Unable to refresh. These invitations may be outdated."
              : "Unable to check invitations."}
          </p>
          <Button size="sm" variant="outline" onClick={resource.retry}>
            Try again
          </Button>
        </div>
      )}
      {resource.data !== null && children}
    </section>
  );
}

export default function InvitationNotifications() {
  const { user, status } = useAuthContext();
  const { student, invites, pendingTeams, pendingVolunteering } =
    useStudentData();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  if (status !== "authenticated" || user?.role !== "student") return null;
  const total = pendingTeams.length + pendingVolunteering.length;
  const checking = student.isLoading || invites.isLoading;
  const unavailable = !!(student.error || invites.error);
  const label = `Invitations, ${total} pending${checking ? ", checking for updates" : ""}${unavailable ? ", some invitations could not be checked" : ""}`;
  const linkClass =
    "flex gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0 h-10 w-10"
          aria-label={label}
        >
          <BellIcon aria-hidden="true" className="size-5" />
          {total > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-background"
            >
              {total > 99 ? "99+" : total}
            </span>
          ) : (
            (checking || unavailable) && (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 size-2 rounded-full bg-muted-foreground ring-2 ring-background"
              />
            )
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={headingId}
        className="w-96 overflow-hidden"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id={headingId} className="font-semibold">
            Invitations
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {total > 0
              ? `${total} pending invitation${total === 1 ? "" : "s"}`
              : checking
                ? "Checking for pending invitations"
                : unavailable
                  ? "Some invitations could not be checked"
                  : "You're all caught up"}
          </p>
        </div>
        <div className="max-h-[min(28rem,60dvh)] divide-y divide-border overflow-y-auto">
          <InvitationGroup title="Team invitations" resource={invites}>
            {pendingTeams.length ? (
              pendingTeams.map((invite) => (
                <Link
                  key={invite.id}
                  href="/profile/team-invites"
                  onClick={() => setOpen(false)}
                  className={linkClass}
                >
                  <UsersIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 break-words">
                    <span className="block font-medium">{invite.teamName}</span>
                    <span className="text-xs text-muted-foreground">
                      {invite.event.title}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending team invitations.
              </p>
            )}
          </InvitationGroup>
          <InvitationGroup title="Volunteer invitations" resource={student}>
            {pendingVolunteering.length ? (
              pendingVolunteering.map((event) => (
                <Link
                  key={event.id}
                  href="/profile/volunteering"
                  onClick={() => setOpen(false)}
                  className={linkClass}
                >
                  <HandHeartIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 break-words">
                    <span className="block font-medium">{event.title}</span>
                    <span className="text-xs text-muted-foreground">
                      You&apos;re invited to volunteer
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No pending volunteer invitations.
              </p>
            )}
          </InvitationGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
