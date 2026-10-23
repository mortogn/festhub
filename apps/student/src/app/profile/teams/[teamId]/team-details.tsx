"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { useResource } from "@festhub/frontend/resource";
import {
  Editor,
  MutationButton,
  PageHeading,
  Section,
} from "@festhub/frontend/ui";
import { formatDateTime } from "@/utils/format-date-time";
import { useProfileData } from "../../_components/profile-data";
import {
  EmptyState,
  ResourceContent,
  StatusBadge,
} from "../../_components/profile-ui";
import {
  getInitials,
  getTeamMembers,
  getTeamStatus,
} from "../../_components/profile-utils";
import { Button } from "@festhub/ui/components/button";
import { z } from "zod";

export default function TeamDetails({ teamId }: { teamId: string }) {
  const { user, teams, student, invites } = useProfileData();
  const item = teams.data?.find((item) => item.team.id === teamId);
  const loadEvent = useCallback(
    async () =>
      item
        ? readResponse(
            await client.events[":id"].$get({
              param: { id: item.team.eventId },
            }),
          )
        : null,
    [item],
  );
  const event = useResource(loadEvent);
  const [now] = useState(() => Date.now());
  if (!z.uuid().safeParse(teamId).success)
    return (
      <EmptyState
        title="Team unavailable"
        description="Check the team link and try again."
        href="/profile/teams"
        action="View your teams"
      />
    );
  if (teams.isLoading || teams.error)
    return <ResourceContent resource={teams}>{null}</ResourceContent>;
  if (!item)
    return (
      <EmptyState
        title="Team unavailable"
        description="This team is not in your teams list."
        href="/profile/teams"
        action="View your teams"
      />
    );
  const { team } = item;
  const members = getTeamMembers(item.teammates);
  const isLeader = team.leaderId === user.id;
  const draft = team.registeredAt === null;
  const config = event.data;
  const deadlineOpen =
    !!config?.registrationClosesAt &&
    new Date(config.registrationClosesAt).getTime() > now;
  const canInvite = !!config?.isActive && deadlineOpen && draft && isLeader;
  const withinWindow =
    canInvite &&
    !!config.registrationOpensAt &&
    new Date(config.registrationOpensAt).getTime() < now;
  const sizeValid =
    (!config?.minTeamSize || members.length >= config.minTeamSize) &&
    (!config?.maxTeamSize || members.length <= config.maxTeamSize);
  const refresh = () => {
    teams.retry();
    student.retry();
    invites.retry();
  };
  return (
    <>
      <PageHeading
        title={team.name}
        description={item.event?.title ?? "Event unavailable"}
        action={<StatusBadge status={getTeamStatus(team)} />}
      />
      <Button asChild variant="link" className="px-0">
        <Link href="/profile/teams">Back to your teams</Link>
      </Button>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section
          title="Team members"
          description={`${members.length} members · You are ${isLeader ? "the team leader" : "a member"}`}
        >
          <ul className="divide-y divide-border">
            {members.map((member, index) => (
              <li
                key={`${member.id}-${index}`}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium"
                >
                  {getInitials(member.name ?? "Member")}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {member.name ?? "Member"}
                    {member.id === student.data?.studentId && " (You)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.id} · {member.department}
                    {member.batch && ` · Batch ${member.batch}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <div className="space-y-6">
          <Section title="Event registration">
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {draft
                  ? "Your team is a draft. Submit it when your roster is ready."
                  : `Submitted ${formatDateTime(team.registeredAt!)}`}
              </p>
              <ResourceContent resource={event}>
                {config && (
                  <>
                    <p>
                      Team size: {config.minTeamSize ?? 1}–
                      {config.maxTeamSize ?? "no maximum"}
                    </p>
                    <p>
                      Registration closes:{" "}
                      {config.registrationClosesAt
                        ? formatDateTime(config.registrationClosesAt)
                        : "Will be announced"}
                    </p>
                    {draft && isLeader && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Members join by accepting their invitations. You
                          cannot change the roster after submission.
                        </p>
                        <MutationButton
                          disabled={!withinWindow || !sizeValid}
                          confirm="Submit this team for event registration? Invitations and roster changes close after submission."
                          action={async () =>
                            readResponse(
                              await client.teams[":id"].submit.$patch({
                                param: { id: team.id },
                              }),
                            )
                          }
                          onSuccess={refresh}
                        >
                          Submit team
                        </MutationButton>
                        {!withinWindow && (
                          <p className="text-xs text-muted-foreground">
                            Submission requires an active event and an open
                            registration period with both dates configured.
                          </p>
                        )}
                        {!sizeValid && (
                          <p className="text-xs text-muted-foreground">
                            Your roster must meet the event&apos;s team-size
                            requirements.
                          </p>
                        )}
                      </>
                    )}
                    <Button asChild variant="secondary" className="w-full">
                      <Link href={`/events/${team.eventId}`}>View event</Link>
                    </Button>
                  </>
                )}
              </ResourceContent>
            </div>
          </Section>
        </div>
      </div>
      {isLeader && draft && (
        <Section
          title="Invite a team member"
          description="Use their institutional student number or FestHub user UUID."
        >
          <ResourceContent resource={event}>
            {config &&
              (canInvite &&
              (!config.maxTeamSize || members.length < config.maxTeamSize) ? (
                <>
                  <Editor
                    fields={[
                      {
                        name: "studentId",
                        label: "Student ID",
                        required: true,
                      },
                    ]}
                    submitLabel="Send invitation"
                    onSubmit={async (values) => {
                      await readResponse(
                        await client["team-invites"].$post({
                          json: {
                            studentId: values.studentId!.trim(),
                            teamId: team.id,
                          },
                        }),
                      );
                    }}
                  />
                  <p className="mt-4 text-xs text-muted-foreground">
                    The invitation was sent when you see a success message. The
                    API does not provide a sent-invitations list; refresh your
                    team after members accept.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={teams.retry}
                  >
                    Refresh members
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Invitations are unavailable because registration has closed,
                  the event is inactive, or your team is full.
                </p>
              ))}
          </ResourceContent>
        </Section>
      )}
    </>
  );
}
