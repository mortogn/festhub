"use client";

import { useRouter } from "next/navigation";
import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { DeleteButton } from "@festhub/frontend/delete-button";
import {
  useProfileData,
  type StudentTeams,
} from "../../_components/profile-data";

type Team = StudentTeams[number]["team"];
type Member = StudentTeams[number]["teammates"][number];

export function DeleteTeamButton({
  team,
  redirectAfterDelete = false,
}: {
  team: Team;
  redirectAfterDelete?: boolean;
}) {
  const { user, teams, student, invites } = useProfileData();
  const router = useRouter();
  if (team.leaderId !== user.id || team.registeredAt !== null) return null;

  return (
    <DeleteButton
      label={`Delete ${team.name}`}
      title="Delete this team?"
      description={`Are you sure you want to delete ${team.name}? All members and invitations will be removed. This action cannot be reversed.`}
      action={async () =>
        readResponse(
          await client.teams[":id"].$delete({ param: { id: team.id } }),
        )
      }
      onSuccess={() => {
        if (redirectAfterDelete) router.replace("/profile/teams");
        teams.retry();
        student.retry();
        invites.retry();
      }}
      successMessage={`${team.name} deleted.`}
    />
  );
}

export function RemoveTeamMemberButton({
  team,
  member,
}: {
  team: Team;
  member: Member;
}) {
  const { user, teams, student, invites } = useProfileData();
  const memberId = member.userId;
  if (
    team.leaderId !== user.id ||
    team.registeredAt !== null ||
    !memberId ||
    memberId === team.leaderId
  )
    return null;

  return (
    <DeleteButton
      label={`Remove ${member.name || "member"} from ${team.name}`}
      title="Remove this team member?"
      description={`Are you sure you want to remove ${member.name || "this member"} from ${team.name}? A removed member cannot be invited back or rejoin this team. This action cannot be reversed.`}
      action={async () =>
        readResponse(
          await client.teams[":id"].member.$delete({
            param: { id: team.id },
            query: { memberId },
          }),
        )
      }
      onSuccess={() => {
        teams.retry();
        student.retry();
        invites.retry();
      }}
      successMessage={`${member.name || "Team member"} removed from ${team.name}.`}
    />
  );
}
