"use client";

import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { MutationButton } from "@festhub/frontend/ui";
import { formatDateTime } from "@/utils/format-date-time";
import { useProfileData } from "../_components/profile-data";
import {
  EmptyState,
  EventDates,
  ProfileSection,
  ResourceContent,
  StatusBadge,
} from "../_components/profile-ui";
import { getInitials } from "../_components/profile-utils";

export default function ProfileInvitesPage() {
  const { invites, teams, student } = useProfileData();
  const refresh = () => {
    invites.retry();
    teams.retry();
    student.retry();
  };
  const sortedInvites = [...(invites.data ?? [])].sort(
    (a, b) =>
      (b.invitedAt ? new Date(b.invitedAt).getTime() : -Infinity) -
      (a.invitedAt ? new Date(a.invitedAt).getTime() : -Infinity),
  );

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Team invitations
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Invitations from teams that haven&apos;t been submitted yet.
        </p>
      </div>

      <ResourceContent resource={invites}>
        {sortedInvites.length === 0 ? (
          <EmptyState
            title="No team invitations"
            description="When a team leader invites you, the invitation will appear here."
          />
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {sortedInvites.map((invite) => (
              <ProfileSection
                key={invite.id}
                title={invite.teamName}
                description={invite.event.title}
                action={<StatusBadge status={invite.status} />}
              >
                <div className="space-y-5">
                  <EventDates
                    startsAt={invite.event.startsAt}
                    endsAt={invite.event.endsAt}
                  />
                  <div className="flex items-start gap-3 rounded-md bg-muted/40 p-4">
                    <div
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium"
                    >
                      {getInitials(invite.leader.name)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Invited by team leader
                      </p>
                      <p className="text-sm font-medium">
                        {invite.leader.name}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        {invite.leader.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Student ID: {invite.leader.studentId}
                      </p>
                    </div>
                  </div>
                  {invite.status === "pending" && (
                    <div className="flex flex-wrap gap-3">
                      {(["accepted", "rejected"] as const).map((action) => (
                        <MutationButton
                          key={action}
                          action={async () =>
                            readResponse(
                              await client["team-invites"][":id"].$patch({
                                param: { id: invite.id },
                                json: { action },
                              }),
                            )
                          }
                          onSuccess={refresh}
                        >
                          {action === "accepted"
                            ? "Accept invitation"
                            : "Decline"}
                        </MutationButton>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {invite.invitedAt
                      ? `Invited ${formatDateTime(invite.invitedAt)}`
                      : "Invitation date unavailable"}
                  </p>
                </div>
              </ProfileSection>
            ))}
          </div>
        )}
      </ResourceContent>
    </>
  );
}
