import client from "@/lib/api";
import { formatDateTime } from "@/utils/format-date-time";
import { Button } from "@festhub/ui/components/button";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  UsersIcon,
} from "@festhub/ui/icons";
import { InferResponseType } from "hono";
import Link from "next/link";
import ParticipantRegisterButton from "./participant-register-button";

type Props = {
  event: InferResponseType<(typeof client)["events"][":id"]["$get"], 200>;
};

export default function ParticipantCard({ event }: Props) {
  // eslint-disable-next-line react-hooks/purity -- This server component checks the registration window at request time.
  const now = Date.now();
  const opensAt = event.registrationOpensAt
    ? new Date(event.registrationOpensAt).getTime()
    : null;
  const closesAt = event.registrationClosesAt
    ? new Date(event.registrationClosesAt).getTime()
    : null;
  const isRegistrationOpen =
    event.isActive &&
    opensAt !== null &&
    closesAt !== null &&
    opensAt < now &&
    now < closesAt;

  let status = "Registration is open";
  if (!event.isActive) status = "Registration is unavailable";
  else if (opensAt === null || closesAt === null)
    status = "Registration dates will be announced";
  else if (now >= closesAt) status = "Registration has closed";
  else if (now <= opensAt) status = "Registration has not opened yet";

  return (
    <div className="border border-border py-6 px-6 space-y-6 rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-secondary-foreground p-4 rounded-md h-min w-min">
          <UsersIcon className="size-6" />
        </div>
        <div>
          <h3 className="text-base font-medium">
            {event.teamBased ? "Team-based Event" : "Join as a Participant"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {event.teamBased
              ? "Create a team or join through an invitation"
              : "Register to take part in this event"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-muted-foreground text-xs">Registration Period</h4>
        <div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <CalendarClockIcon className="size-5" />
            <h4 className="text-sm">Opens</h4>
          </div>
          <p className="text-lg font-semibold text-center">
            {event.registrationOpensAt
              ? formatDateTime(event.registrationOpensAt)
              : "Will be announced"}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <CalendarClockIcon className="size-5" />
            <h4 className="text-sm">Closes</h4>
          </div>
          <p className="text-lg font-semibold text-center">
            {event.registrationClosesAt
              ? formatDateTime(event.registrationClosesAt)
              : "Will be announced"}
          </p>
        </div>
      </div>

      {event.teamBased ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Maximum teams</span>
            <span className="font-semibold">{event.maxTeams || "No limit"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Minimum team size</span>
            <span className="font-semibold">
              {event.minTeamSize ?? "Not specified"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Maximum team size</span>
            <span className="font-semibold">
              {event.maxTeamSize || "No limit"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Maximum participants</span>
          <span className="font-semibold">
            {event.maxParticipants || "No limit"}
          </span>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{status}</p>
      {event.teamBased ? (
        <div className="space-y-2">
          <Button asChild variant="link" className="w-full justify-between px-0">
            <Link href="/teams/create" target="_blank" rel="noopener noreferrer">
              Create a team
              <ExternalLinkIcon />
            </Link>
          </Button>
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
      ) : (
        <ParticipantRegisterButton
          eventId={event.id}
          disabled={!isRegistrationOpen}
        />
      )}
    </div>
  );
}
