"use client";

import { formatDateTime } from "@/utils/format-date-time";
import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
import { UsersIcon } from "@festhub/ui/icons";
import Link from "next/link";
import { useProfileData } from "../_components/profile-data";
import {
  EmptyState,
  EventDates,
  ProfileSection,
  ResourceContent,
  StatusBadge,
} from "../_components/profile-ui";
import {
  getInitials,
  getTeamMembers,
  getTeamStatus,
} from "../_components/profile-utils";

export default function ProfileTeamsPage() {
  const { user, student, teams } = useProfileData();
  const sortedTeams = [...(teams.data ?? [])].sort((a, b) => a.team.name.localeCompare(b.team.name));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">My teams</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Your teams, event registrations, and member rosters.</p>
        </div>
        <Button asChild><Link href="/teams/create"><UsersIcon />Create a team</Link></Button>
      </div>

      <ResourceContent resource={teams}>
        {sortedTeams.length === 0 ? (
          <EmptyState title="You haven't joined a team yet" description="Create a team or check your invitations to join an existing one." href="/profile/team-invites" action="View team invitations" />
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {sortedTeams.map(({ team, event, teammates }) => {
              const members = getTeamMembers(teammates);
              return (
                <ProfileSection key={team.id} title={team.name} description={event?.title ?? "Event unavailable"} action={<StatusBadge status={getTeamStatus(team)} />}>
                  <div className="mb-5 space-y-3">
                    <Badge variant="outline">{team.leaderId === user.id ? "Team leader" : "Member"}</Badge>
                    {event && <EventDates startsAt={event.startsAt} endsAt={event.endsAt} />}
                    {team.registeredAt && <p className="text-xs text-muted-foreground">Submitted {formatDateTime(team.registeredAt)}</p>}
                  </div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Team members</h3>
                    <span className="text-xs tabular-nums text-muted-foreground">Members: {members.length}</span>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No member information available.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {members.map((member, index) => (
                        <li key={`${member.id ?? "member"}-${index}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-medium">{getInitials(member.name ?? "Unknown member")}</div>
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-medium">{member.name || "Unknown member"}{member.id && member.id === student.data?.studentId && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}</p>
                            <p className="text-xs text-muted-foreground">{member.id || "Student ID unavailable"}</p>
                            <p className="break-words text-xs text-muted-foreground">{member.department || "Department unavailable"}{member.batch && ` · Batch ${member.batch}`}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </ProfileSection>
              );
            })}
          </div>
        )}
      </ResourceContent>
    </>
  );
}
