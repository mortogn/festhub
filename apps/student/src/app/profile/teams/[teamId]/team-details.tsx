"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { useResource } from "@festhub/frontend/resource";
import { MutationButton, PageHeading, Section } from "@festhub/frontend/ui";
import { UploadedAvatar } from "@festhub/frontend/uploaded-image";
import { formatDateTime } from "@/utils/format-date-time";
import { useProfileData } from "../../_components/profile-data";
import {
  EmptyState,
  ResourceContent,
  StatusBadge,
} from "../../_components/profile-ui";
import { getTeamMembers, getTeamStatus } from "../../_components/profile-utils";
import { Button } from "@festhub/ui/components/button";
import { z } from "zod";
import { TeamInviteDialog } from "../_components/team-invite-dialog";
import { ArrowLeft } from "@festhub/ui/icons";

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
  const eligibleToSubmit =
    !!config?.isActive && deadlineOpen && draft && isLeader;
  const withinWindow =
    eligibleToSubmit &&
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
      <div className="space-y-1">
        <Button asChild variant={"secondary"} size={"icon"}>
          <Link href={"/profile/teams"}>
            <ArrowLeft />
            <span className="sr-only">Go back to team</span>
          </Link>
        </Button>
        <PageHeading
          title={team.name}
          description={item.event?.title ?? "Event unavailable"}
          action={<StatusBadge status={getTeamStatus(team)} />}
        />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section
          title={
            <>
              Team members <span className="font-mono">({members.length})</span>
            </>
          }
          description={`You are ${isLeader ? "the team leader" : "a member"}`}
          action={
            <TeamInviteDialog
              team={team}
              memberCount={members.length}
              size="icon"
            />
          }
        >
          <ul className="divide-y divide-border">
            {members.map((member, index) => (
              <li
                key={`${member.id}-${index}`}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
              >
                <UploadedAvatar
                  imageId={member.displayImageId}
                  name={member.name || "Member"}
                  className="size-9"
                />
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
    </>
  );
}
