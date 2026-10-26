"use client";

import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
import { UploadedAvatar } from "@festhub/frontend/uploaded-image";
import { UsersIcon } from "@festhub/ui/icons";
import Link from "next/link";
import { useProfileData } from "../_components/profile-data";
import {
  EmptyState,
  ProfileSection,
  ResourceContent,
  StatusBadge,
} from "../_components/profile-ui";
import { getTeamMembers, getTeamStatus } from "../_components/profile-utils";
import { TeamInviteDialog } from "./_components/team-invite-dialog";
import {
  DeleteTeamButton,
  RemoveTeamMemberButton,
} from "./_components/team-delete-buttons";

export default function ProfileTeamsPage() {
  const { user, teams } = useProfileData();
  const sortedTeams = [...(teams.data ?? [])].sort((a, b) =>
    a.team.name.localeCompare(b.team.name),
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">My teams</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your teams, event registrations, and member rosters.
          </p>
        </div>
        <Button asChild>
          <Link href="/teams/create">
            <UsersIcon />
            Create a team
          </Link>
        </Button>
      </div>

      <ResourceContent resource={teams}>
        {sortedTeams.length === 0 ? (
          <EmptyState
            title="You haven't joined a team yet"
            description="Create a team or check your invitations to join an existing one."
            href="/profile/team-invites"
            action="View team invitations"
          />
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {sortedTeams.map(({ team, event, teammates }) => {
              const members = getTeamMembers(teammates);
              return (
                <ProfileSection
                  key={team.id}
                  title={
                    <Link
                      href={`/profile/teams/${team.id}`}
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      {team.name}
                    </Link>
                  }
                  description={event?.title ?? "Event unavailable"}
                  action={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={getTeamStatus(team)} />
                      <DeleteTeamButton team={team} />
                    </div>
                  }
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Team members{" "}
                      <span className="font-mono">({members.length})</span>
                    </h3>
                    <TeamInviteDialog
                      team={team}
                      memberCount={members.length}
                    />
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No member information available.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {members.map((member, index) => (
                        <li
                          key={`${member.userId ?? member.id ?? "member"}-${index}`}
                          className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <UploadedAvatar
                            imageId={member.displayImageId}
                            name={member.name || "Unknown member"}
                            className="size-9"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <span className="break-words">
                                {member.name || "Unknown member"}
                              </span>
                              {member.userId === team.leaderId && (
                                <Badge variant="outline">Leader</Badge>
                              )}
                              {member.userId === user.id && (
                                <span className="text-xs font-normal text-muted-foreground">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.id || "Student ID unavailable"}
                            </p>
                            <p className="break-words text-xs text-muted-foreground">
                              {member.department || "Department unavailable"}
                              {member.batch && ` · Batch ${member.batch}`}
                            </p>
                          </div>
                          <RemoveTeamMemberButton team={team} member={member} />
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
