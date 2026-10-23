"use client";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import { ExternalLinkIcon } from "@festhub/ui/icons";
import { useEventActivity } from "./event-activity";
import { ResourceContent } from "@festhub/frontend/ui";

export default function TeamEventActions({ eventId }: { eventId: string }) {
  const { teams } = useEventActivity();
  const current = teams.data?.find((item) => item.team.eventId === eventId);
  return (
    <div className="space-y-2">
      <ResourceContent resource={teams}>
        <Button asChild variant="link" className="w-full justify-between px-0">
          <Link
            href={
              current
                ? `/profile/teams/${current.team.id}`
                : `/teams/create?eventId=${eventId}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {current ? "View your team" : "Create a team"}
            <ExternalLinkIcon />
          </Link>
        </Button>
      </ResourceContent>
      <Button asChild variant="link" className="w-full justify-between px-0">
        <Link
          href="/profile/team-invites"
          target="_blank"
          rel="noopener noreferrer"
        >
          View team invitations
          <ExternalLinkIcon />
        </Link>
      </Button>
    </div>
  );
}
