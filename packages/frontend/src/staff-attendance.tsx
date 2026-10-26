"use client";

import { useCallback, useRef, useState } from "react";
import type { InferResponseType } from "hono";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@festhub/ui/components/dialog";
import client, { errorMessage, readResponse } from "./api";
import { formatDateTime } from "./dates";
import { QrScanner } from "./qr-scanner";
import { useResource } from "./resource";
import {
  EmptyState,
  PageHeading,
  PersonAvatar,
  ResourceContent,
  Section,
} from "./ui";

type StudentInfo = InferResponseType<
  (typeof client.events)[":id"]["attendance"]["info"]["$post"],
  200
>;
type CheckinRole = "participant" | "volunteer";
type AttendanceEntry = {
  id: string;
  name: string;
  email: string;
  studentId: string;
  checkedInAt: string;
  roles: CheckinRole[];
};

function mergeAttendance(entries: AttendanceEntry[]) {
  const people = new Map<string, AttendanceEntry>();
  for (const entry of entries) {
    const previous = people.get(entry.id);
    people.set(
      entry.id,
      previous
        ? {
            ...entry,
            roles: [...new Set([...previous.roles, ...entry.roles])],
            checkedInAt:
              Date.parse(previous.checkedInAt) > Date.parse(entry.checkedInAt)
                ? previous.checkedInAt
                : entry.checkedInAt,
          }
        : entry,
    );
  }
  return [...people.values()].sort(
    (a, b) => Date.parse(b.checkedInAt) - Date.parse(a.checkedInAt),
  );
}

function AttendanceList({
  entries,
  empty,
}: {
  entries: AttendanceEntry[];
  empty: string;
}) {
  if (!entries.length) return <EmptyState title={empty} />;
  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-medium break-words">{entry.name}</p>
            <p className="text-sm text-muted-foreground break-words">
              {entry.studentId} · {entry.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.checkedInAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {entry.roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize">
                {role}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StaffAttendancePage({ id }: { id: string }) {
  const loadEvent = useCallback(
    async () =>
      readResponse(await client.events[":id"].$get({ param: { id } })),
    [id],
  );
  const event = useResource(loadEvent);
  const loadAttendance = useCallback(async () => {
    // The attendance GET currently returns a single record without student details.
    // These existing rosters include identities and every participant/volunteer.
    const [participants, volunteers] = await Promise.all([
      client.events[":id"].participants
        .$get({ param: { id } })
        .then(readResponse),
      client.volunteers[":eventId"]
        .$get({ param: { eventId: id } })
        .then(readResponse),
    ]);
    return mergeAttendance([
      ...participants.flatMap(
        (person): AttendanceEntry[] =>
          person.checkedInAt && person.registrationStatus === "accepted"
            ? [{
                id: person.id,
                name: person.name,
                email: person.email,
                studentId: person.studentId,
                checkedInAt: person.checkedInAt,
                roles: ["participant"],
              }]
            : [],
      ),
      ...volunteers.flatMap(
        (person): AttendanceEntry[] =>
          person.checkedInAt &&
          (person.inviteStatus === "accepted" ||
            person.registrationStatus === "approved")
            ? [{
                ...person.student,
                checkedInAt: person.checkedInAt,
                roles: ["volunteer"],
              }]
            : [],
      ),
    ]);
  }, [id]);
  const attendance = useResource(loadAttendance);
  const [session, setSession] = useState<AttendanceEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [token, setToken] = useState("");
  const [participant, setParticipant] = useState(false);
  const [volunteer, setVolunteer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scanLocked = useRef(false);
  const confirmLocked = useRef(false);

  const scanStudent = useCallback(async (value: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    const nextToken = value.trim();
    setDialogOpen(true);
    setStudent(null);
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (
        !/^qr:s:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nextToken)
      ) {
        throw new Error(
          "Scan a student's My QR code. This is not a valid student QR.",
        );
      }
      const info = await readResponse(
        await client.events[":id"].attendance.info.$post({
          param: { id },
          json: { studentQrToken: nextToken },
        }),
      );
      setToken(nextToken);
      setStudent(info);
      setParticipant(!!info.participant.studentId && !info.eventCheckin);
      setVolunteer(!!info.volunteer.studentId && !info.volunteerCheckin);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }, [id]);

  function closeDialog() {
    if (busy) return;
    setDialogOpen(false);
    scanLocked.current = false;
    setToken("");
    setStudent(null);
    setError(null);
  }

  async function confirmCheckin() {
    if (!student || (!participant && !volunteer) || confirmLocked.current) return;
    confirmLocked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await readResponse(
        await client.events[":id"].attendance.confirm.$post({
          param: { id },
          json: { studentQrToken: token },
          query: {
            participantCheckin: participant ? "true" : "false",
            volunteerCheckin: volunteer ? "true" : "false",
          },
        }),
      );
      const roles = result.updated.filter(
        (role): role is CheckinRole => role === "participant" || role === "volunteer",
      );
      setSession((previous) =>
        mergeAttendance([
          ...previous,
          {
            id: student.id,
            name: student.name,
            email: student.email,
            studentId: student.studentId,
            checkedInAt: new Date().toISOString(),
            roles,
          },
        ]),
      );
      setSuccess(`${student.name} checked in as ${roles.join(" and ")}.`);
      attendance.retry();
      setDialogOpen(false);
      scanLocked.current = false;
      setStudent(null);
      setToken("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      confirmLocked.current = false;
      setBusy(false);
    }
  }

  const hasParticipant = !!student?.participant.studentId;
  const hasVolunteer = !!student?.volunteer.studentId;

  return (
    <div className="space-y-6">
      <Button asChild variant="link" className="px-0">
        <Link href={`/dashboard/events/${id}`}>← Manage event</Link>
      </Button>
      <ResourceContent resource={event}>
        {event.data && (
          <>
            <PageHeading title="Scan students" description={event.data.title} />
            <Section
              title="Student check-in"
              description="Scan a student's QR, review their details, and approve their entry."
            >
              <div className="mx-auto max-w-sm space-y-3">
                <QrScanner onScan={scanStudent} paused={dialogOpen || busy} />
                {success && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {success}
                  </p>
                )}
              </div>
            </Section>
            <Section
              title={`This session (${session.length})`}
              description="Students you checked in on this page. This list resets when you leave or refresh."
            >
              <AttendanceList
                entries={session}
                empty="No students checked in this session"
              />
            </Section>
            <Section
              title={`All checked-in students${attendance.data ? ` (${attendance.data.length})` : ""}`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={attendance.retry}
                  disabled={attendance.isLoading}
                >
                  Refresh
                </Button>
              }
            >
              <ResourceContent resource={attendance}>
                <AttendanceList
                  entries={attendance.data ?? []}
                  empty="No checked-in students yet"
                />
              </ResourceContent>
            </Section>
          </>
        )}
      </ResourceContent>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          showCloseButton={!busy}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {student
                ? "Confirm student entry"
                : busy
                  ? "Looking up student…"
                  : "Unable to check in"}
            </DialogTitle>
            <DialogDescription>
              {student
                ? "Review the student and select the roles to check in."
                : "Student QR verification"}
            </DialogDescription>
          </DialogHeader>
          {student && (
            <>
              <div className="flex min-w-0 items-start gap-3">
                <PersonAvatar
                  name={student.name}
                  imageId={student.displayImageId}
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium break-words">{student.name}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {student.studentId} · {student.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {student.department} · Batch {student.batch}
                  </p>
                </div>
              </div>
              {student.team.id && (
                <div className="space-y-1 rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Participant&apos;s team
                  </p>
                  <p className="font-medium break-words">{student.team.name}</p>
                  {student.team.status && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {student.team.status}
                    </p>
                  )}
                </div>
              )}
              <fieldset className="space-y-3" disabled={busy}>
                <legend className="mb-2 text-sm font-medium">Check in as</legend>
                {hasParticipant && (
                  <label className="flex items-center gap-3 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={participant}
                      disabled={busy || student.eventCheckin}
                      onChange={(event) => setParticipant(event.target.checked)}
                    />
                    <span>
                      Participant
                      {student.eventCheckin && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Already checked in
                        </span>
                      )}
                    </span>
                  </label>
                )}
                {hasVolunteer && (
                  <label className="flex items-center gap-3 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={volunteer}
                      disabled={busy || student.volunteerCheckin}
                      onChange={(event) => setVolunteer(event.target.checked)}
                    />
                    <span>
                      Volunteer
                      {student.volunteerCheckin && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Already checked in
                        </span>
                      )}
                    </span>
                  </label>
                )}
              </fieldset>
              {!participant && !volunteer && (
                <p className="text-sm text-muted-foreground">
                  {(hasParticipant && !student.eventCheckin) ||
                  (hasVolunteer && !student.volunteerCheckin)
                    ? "Select at least one role to continue."
                    : "This student has already checked in for all their eligible roles."}
                </p>
              )}
            </>
          )}
          {error && (
            <p
              role="alert"
              className="whitespace-pre-line break-words text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={closeDialog}>
              Cancel
            </Button>
            {student && (
              <Button
                disabled={busy || (!participant && !volunteer)}
                onClick={confirmCheckin}
              >
                {busy ? "Checking in…" : "Approve check-in"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
