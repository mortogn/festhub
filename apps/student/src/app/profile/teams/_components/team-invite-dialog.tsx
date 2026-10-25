"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { InferResponseType } from "hono";
import client from "@/lib/api";
import { errorMessage, readResponse } from "@festhub/frontend/api";
import { useResource } from "@festhub/frontend/resource";
import { Button } from "@festhub/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@festhub/ui/components/dialog";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { PlusIcon } from "@festhub/ui/icons";
import {
  useProfileData,
  type StudentTeams,
} from "../../_components/profile-data";
import { ResourceContent } from "../../_components/profile-ui";

type Event = InferResponseType<(typeof client.events)[":id"]["$get"], 200>;
type Props = {
  team: StudentTeams[number]["team"];
  memberCount: number;
  size?: "icon" | "icon-sm";
};

function invitationIssue(event: Event, memberCount: number, now: number) {
  if (!event.isActive)
    return "This event is inactive. Invitations are unavailable.";
  if (
    !event.registrationClosesAt ||
    Date.parse(event.registrationClosesAt) <= now
  )
    return "Registration has closed or its deadline is unavailable. Invitations cannot be sent.";
  if (event.maxTeamSize && memberCount >= event.maxTeamSize)
    return "Your team already has the maximum number of members.";
  return null;
}

export function TeamInviteDialog(props: Props) {
  const { user } = useProfileData();
  if (props.team.leaderId !== user.id || props.team.registeredAt !== null)
    return null;
  return <InvitationDialog {...props} />;
}

function InvitationDialog({ team, memberCount, size = "icon-sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const locked = useRef(false);
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const feedbackId = `${inputId}-feedback`;
  const loadEvent = useCallback(
    async () =>
      open
        ? readResponse(
            await client.events[":id"].$get({ param: { id: team.eventId } }),
          )
        : null,
    [open, team.eventId],
  );
  const event = useResource(loadEvent);
  const unavailable = event.data
    ? invitationIssue(event.data, memberCount, now)
    : null;
  const canSend =
    !!event.data && !event.isLoading && !event.error && !unavailable;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (locked.current) return;
        setOpen(value);
        setNow(Date.now());
        setIdentifier("");
        setError(null);
        setSuccess(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          aria-label={`Invite a member to ${team.name}`}
          title="Invite a team member"
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (locked.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (locked.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription className="break-words">
            Invite a student to {team.name} using their student ID or FestHub
            user UUID. They will join the team after accepting your invitation.
          </DialogDescription>
        </DialogHeader>
        <ResourceContent resource={event}>
          {event.data && (
            <form
              className="space-y-4"
              aria-busy={pending}
              onSubmit={async (submitEvent) => {
                submitEvent.preventDefault();
                if (locked.current || !event.data) return;
                setError(null);
                setSuccess(null);
                const studentId = identifier.trim();
                if (!studentId) {
                  setError("Enter a student ID or user UUID.");
                  return;
                }
                const issue = invitationIssue(
                  event.data,
                  memberCount,
                  Date.now(),
                );
                if (issue) {
                  setError(issue);
                  return;
                }
                locked.current = true;
                setPending(true);
                try {
                  await readResponse(
                    await client["team-invites"].$post({
                      json: { teamId: team.id, studentId },
                    }),
                  );
                  setSuccess(
                    `Invitation sent to ${studentId}. They will appear in the roster after accepting.`,
                  );
                  setIdentifier("");
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  locked.current = false;
                  setPending(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor={inputId}>Student ID or user UUID</Label>
                <Input
                  id={inputId}
                  name="studentId"
                  value={identifier}
                  required
                  autoComplete="off"
                  autoFocus
                  disabled={pending || !canSend}
                  aria-invalid={!!error}
                  aria-describedby={`${helpId} ${feedbackId}`}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                />
                <p id={helpId} className="text-xs text-muted-foreground">
                  Use the student&apos;s institutional ID or their FestHub user
                  UUID.
                </p>
              </div>
              <div id={feedbackId} aria-live="polite">
                {unavailable && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {unavailable}
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {success && (
                  <p
                    role="status"
                    className="break-words text-sm text-muted-foreground"
                  >
                    {success}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={pending || !canSend || !identifier.trim()}
                >
                  {pending ? "Sending invitation…" : "Send invitation"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </ResourceContent>
      </DialogContent>
    </Dialog>
  );
}
