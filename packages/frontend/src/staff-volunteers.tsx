"use client";

import { useCallback, useId, useState } from "react";
import type { InferResponseType } from "hono";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import { UploadedAvatar } from "./uploaded-image";
import { Label } from "@festhub/ui/components/label";
import { Input } from "@festhub/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@festhub/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import {
  CalendarClockIcon,
  HandHeartIcon,
  SearchIcon,
} from "@festhub/ui/icons";
import client, { readResponse } from "./api";
import { formatDateTime } from "./dates";
import { useResource } from "./resource";
import { DeleteButton } from "./delete-button";
import {
  EmptyState,
  MutationButton,
  PageHeading,
  ResourceContent,
  Section,
  StatusBadge,
} from "./ui";

type Volunteer = InferResponseType<typeof client.volunteers.$get, 200>[number];
type EventSummary = InferResponseType<typeof client.events.$get, 200>[number];
type Group = "all" | "requests" | "invitations" | "confirmed" | "closed";
const groups: { value: Group; label: string }[] = [
  { value: "all", label: "All volunteers" },
  { value: "requests", label: "Needs review" },
  { value: "invitations", label: "Awaiting reply" },
  { value: "confirmed", label: "Confirmed" },
  { value: "closed", label: "Not selected" },
];
function confirmed(row: Volunteer) {
  return (
    row.inviteStatus === "accepted" || row.registrationStatus === "approved"
  );
}
function matchesGroup(row: Volunteer, group: Group) {
  if (group === "confirmed") return confirmed(row);
  if (group === "requests")
    return !confirmed(row) && row.registrationStatus === "pending";
  if (group === "invitations")
    return !confirmed(row) && row.inviteStatus === "pending";
  if (group === "closed")
    return (
      !confirmed(row) &&
      row.registrationStatus !== "pending" &&
      row.inviteStatus !== "pending"
    );
  return true;
}
function VolunteerFilters({
  search,
  setSearch,
  group,
  setGroup,
  rows,
  events,
  eventId,
  setEventId,
}: {
  search: string;
  setSearch: (value: string) => void;
  group: Group;
  setGroup: (value: Group) => void;
  rows: Volunteer[];
  events?: EventSummary[];
  eventId?: string;
  setEventId?: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label="Search volunteers"
            placeholder="Search name, student ID, email, or event"
            className="h-11 pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {events && setEventId && (
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger
              aria-label="Filter by event"
              className="w-full sm:w-60 data-[size=default]:h-11"
            >
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div
        role="group"
        aria-label="Volunteer status"
        className="grid grid-cols-2 gap-1.5 rounded-xl border bg-card p-2 sm:flex sm:flex-wrap"
      >
        {groups.map((item) => (
          <Button
            key={item.value}
            variant={group === item.value ? "secondary" : "ghost"}
            aria-pressed={group === item.value}
            onClick={() => setGroup(item.value)}
            className={`${item.value === "all" ? "col-span-2 " : ""}justify-between gap-1.5 text-xs sm:justify-center sm:text-sm`}
          >
            {item.label}
            <span className="rounded-md bg-background px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {rows.filter((row) => matchesGroup(row, item.value)).length}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
function VolunteerCard({
  row,
  event,
  showEvent,
  onChange,
}: {
  row: Volunteer;
  event?: EventSummary;
  showEvent: boolean;
  onChange: () => void;
}) {
  const [now] = useState(() => Date.now());
  const ended = !!event && Date.parse(event.endsAt) <= now;
  const canDelete =
    !!event?.volunteerStartsAt &&
    !!event.volunteerEndsAt &&
    Date.parse(event.volunteerStartsAt) > now &&
    Date.parse(event.volunteerEndsAt) > now;
  const canReview = !!row.registeredAt && !confirmed(row) && !!event && !ended;
  const isConfirmed = confirmed(row);
  const initials = row.student.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const status = isConfirmed
    ? "Confirmed"
    : row.registrationStatus === "pending"
      ? "Needs review"
      : row.inviteStatus === "pending"
        ? "Awaiting reply"
        : "Not selected";
  const duty = row.checkedOutAt
    ? "Duty completed"
    : row.checkedInAt
      ? "Checked in"
      : isConfirmed
        ? "Ready for duty"
        : "Not assigned";
  const review = async (action: "approved" | "rejected") =>
    readResponse(
      await client.volunteers.request.$patch({
        query: { eventId: row.eventId },
        json: { studentId: row.student.id, action },
      }),
    );
  return (
    <article className="flex min-w-0 flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex-1 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
          <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase text-secondary-foreground"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <Link
                className="font-semibold break-words hover:underline"
                href={`/dashboard/students/${row.student.id}`}
              >
                {row.student.name}
              </Link>
              <p className="text-xs break-words text-muted-foreground">
                {row.student.studentId}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={
              isConfirmed
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : status === "Needs review"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : ""
            }
          >
            {status}
          </Badge>
        </div>
        <p className="text-sm break-all text-muted-foreground">
          {row.student.email}
        </p>
        {showEvent && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
            <CalendarClockIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 space-y-1">
              <Link
                href={`/dashboard/events/${row.eventId}`}
                className="text-sm font-medium break-words hover:underline"
              >
                {event?.title ?? "View event"}
              </Link>
              {event && (
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.startsAt)}
                  {ended ? " · Ended" : ""}
                </p>
              )}
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1.5">
            <dt className="text-muted-foreground">Application</dt>
            <dd>
              {row.registrationStatus ? (
                <StatusBadge status={row.registrationStatus} />
              ) : (
                "No application"
              )}
            </dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-muted-foreground">Invitation</dt>
            <dd>
              {row.inviteStatus ? (
                <StatusBadge status={row.inviteStatus} />
              ) : (
                "No invitation"
              )}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-2 text-sm">
          <HandHeartIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span>{duty}</span>
        </div>
        <details className="rounded-lg border text-sm">
          <summary className="cursor-pointer rounded-lg px-3 py-2.5 text-muted-foreground outline-offset-2 focus-visible:outline-2">
            View activity &amp; duty history
          </summary>
          <dl className="space-y-3 border-t px-3 py-3 text-xs">
            {(
              [
                ["Applied", row.registeredAt],
                ["Invited", row.invitationSentAt],
                ["Assigned", row.assignedAt],
                ["Checked in", row.checkedInAt],
                ["Checked out", row.checkedOutAt],
              ] as const
            ).map(([label, date]) => (
              <div
                key={label}
                className="flex flex-wrap justify-between gap-x-3 gap-y-1"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{date ? formatDateTime(date) : "Not recorded"}</dd>
              </div>
            ))}
            {row.invitedBy?.name && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Invited by</dt>
                <dd className="break-words">{row.invitedBy.name}</dd>
              </div>
            )}
          </dl>
          <p className="px-3 pb-3 text-xs text-muted-foreground">
            All times in Bangladesh time (UTC+06:00).
          </p>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-3 sm:px-5">
        {canReview ? (
          <>
            <MutationButton
              variant="default"
              action={() => review("approved")}
              onSuccess={onChange}
              successMessage={`${row.student.name}'s application approved.`}
              confirm={`Approve ${row.student.name}'s volunteer application?`}
            >
              Approve application
            </MutationButton>
            {row.registrationStatus !== "rejected" && (
              <MutationButton
                action={() => review("rejected")}
                onSuccess={onChange}
                successMessage={`${row.student.name}'s application rejected.`}
                confirm={`Reject ${row.student.name}'s volunteer application?`}
              >
                Reject
              </MutationButton>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isConfirmed
              ? "Volunteer confirmed. No review needed."
              : ended
                ? "Event ended. Applications are closed."
                : !event
                  ? "Load event information to review applications."
                  : row.inviteStatus === "pending"
                    ? "Waiting for the student to respond."
                    : "No application to review."}
          </p>
        )}
        {canDelete && (
          <div className="ml-auto">
            <DeleteButton
              label={`Remove ${row.student.name} as a volunteer for ${event.title}`}
              title="Remove this volunteer?"
              description={`Are you sure you want to remove ${row.student.name} as a volunteer for ${event.title}? Their application, invitation, and duty record for this event will be permanently deleted. This action cannot be reversed.`}
              action={async () => {
                if (
                  Date.parse(event.volunteerStartsAt!) <= Date.now() ||
                  Date.parse(event.volunteerEndsAt!) <= Date.now()
                )
                  throw new Error(
                    "Volunteer duty has already started or ended. This volunteer can no longer be removed.",
                  );
                return readResponse(
                  await client.volunteers[":id"].$delete({
                    param: { id: row.student.id },
                    query: { eventId: row.eventId },
                  }),
                );
              }}
              onSuccess={onChange}
              successMessage={`${row.student.name} removed from the volunteer roster.`}
            />
          </div>
        )}
      </div>
    </article>
  );
}
function VolunteerCards({
  rows,
  events,
  showEvent = true,
  onChange,
}: {
  rows: Volunteer[];
  events: EventSummary[];
  showEvent?: boolean;
  onChange: () => void;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No volunteers found"
        description="Try another search or status, or invite a student from an event's volunteers tab."
      />
    );
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {rows.map((row) => (
        <VolunteerCard
          key={`${row.eventId}-${row.student.id}`}
          row={row}
          event={events.find((item) => item.id === row.eventId)}
          showEvent={showEvent}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
function searchRows(
  rows: Volunteer[],
  search: string,
  events: EventSummary[],
  eventId = "all",
) {
  const query = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (eventId === "all" || row.eventId === eventId) &&
      [
        row.student.name,
        row.student.email,
        row.student.studentId,
        events.find((event) => event.id === row.eventId)?.title ?? "",
      ].some((value) => value.toLowerCase().includes(query)),
  );
}
function ResultsSummary({
  count,
  filtered,
  clear,
}: {
  count: number;
  filtered: boolean;
  clear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-sm text-muted-foreground">
        {count} volunteer {count === 1 ? "record" : "records"}
        {filtered ? " match your filters" : " in this view"}
      </p>
      {filtered && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
export function StaffVolunteersPage() {
  const [period, setPeriod] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [eventId, setEventId] = useState("all");
  const load = useCallback(
    async () =>
      readResponse(await client.volunteers.$get({ query: { filter: period } })),
    [period],
  );
  const loadEvents = useCallback(
    async () => readResponse(await client.events.$get()),
    [],
  );
  const resource = useResource(load);
  const events = useResource(loadEvents);
  const searched = searchRows(
    resource.data ?? [],
    search,
    events.data ?? [],
    eventId,
  );
  const rows = searched.filter((row) => matchesGroup(row, group));
  const filtered = !!search || group !== "all" || eventId !== "all";
  return (
    <div className="space-y-6">
      <PageHeading
        title="Volunteers"
        description="Review applications, follow up on invitations, and keep track of every volunteer's duty."
        action={
          <Select
            value={period}
            onValueChange={(value) => {
              setPeriod(value as "active" | "all");
              setEventId("all");
            }}
          >
            <SelectTrigger
              aria-label="Volunteer period"
              className="w-full sm:w-56 data-[size=default]:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Upcoming and ongoing</SelectItem>
              <SelectItem value="all">All history</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="space-y-5">
        <VolunteerFilters
          search={search}
          setSearch={setSearch}
          group={group}
          setGroup={setGroup}
          rows={searched}
          events={(events.data ?? []).filter((event) =>
            resource.data?.some((row) => row.eventId === event.id),
          )}
          eventId={eventId}
          setEventId={setEventId}
        />
        <ResourceContent resource={events}>{null}</ResourceContent>
        <ResourceContent resource={resource}>
          <div className="space-y-4">
            <ResultsSummary
              count={rows.length}
              filtered={filtered}
              clear={() => {
                setSearch("");
                setGroup("all");
                setEventId("all");
              }}
            />
            <VolunteerCards
              rows={rows}
              events={events.data ?? []}
              onChange={resource.retry}
            />
          </div>
        </ResourceContent>
      </div>
    </div>
  );
}
function InviteVolunteer({
  eventId,
  onChange,
  disabled,
}: {
  eventId: string;
  onChange: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [lookupId, setLookupId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const inputId = useId();
  const loadStudent = useCallback(
    async () =>
      lookupId
        ? readResponse(
            await client.students[":id"].$get({ param: { id: lookupId } }),
          )
        : null,
    [lookupId],
  );
  const student = useResource(loadStudent);
  const searching = lookupId !== null && student.isLoading;
  const match = lookupId === studentId.trim() ? student.data : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setStudentId("");
        setLookupId(null);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>Invite a volunteer</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite a volunteer</DialogTitle>
          <DialogDescription>
            Enter a student ID to find the student and send an invitation.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          aria-busy={searching}
          onSubmit={(event) => {
            event.preventDefault();
            const id = studentId.trim();
            if (!id || searching || inviting) return;
            if (id === lookupId) student.retry();
            else setLookupId(id);
          }}
        >
          <Label htmlFor={inputId}>Student ID</Label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              placeholder="Type or paste student ID"
              value={studentId}
              autoComplete="off"
              spellCheck={false}
              required
              disabled={inviting}
              onChange={(event) => {
                setStudentId(event.target.value);
                setLookupId(null);
              }}
              className="h-11 min-w-0 flex-1"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-11"
              disabled={!studentId.trim() || searching || inviting}
            >
              <SearchIcon aria-hidden="true" />
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
        {searching && (
          <p role="status" className="text-sm text-muted-foreground">
            Looking up student…
          </p>
        )}
        {lookupId && !searching && (
          <ResourceContent resource={student}>
            {match && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 sm:gap-4 sm:p-4"
              >
                <UploadedAvatar
                  imageId={match.displayImageId}
                  name={match.name}
                  className="size-12 sm:size-14"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="text-base font-semibold break-words">
                      {match.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {match.studentId}
                    </p>
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Department
                      </dt>
                      <dd className="break-words">
                        {match.department || "Not provided"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Batch</dt>
                      <dd>{match.batch || "Not provided"}</dd>
                    </div>
                    <div className="w-full">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="break-all">{match.email}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </ResourceContent>
        )}
        <div className="space-y-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            The student can accept from their volunteering page.
          </p>
          <MutationButton
            className="h-11 w-full"
            variant="default"
            disabled={disabled || !match || inviting}
            action={async () => {
              if (!match) return;
              setInviting(true);
              try {
                await readResponse(
                  await client.volunteers.invite.$post({
                    json: { eventId, studentId: match.id },
                  }),
                );
              } finally {
                setInviting(false);
              }
            }}
            successMessage="Invitation sent. The student can respond from their volunteering page."
            onSuccess={() => {
              setOpen(false);
              setStudentId("");
              setLookupId(null);
              onChange();
            }}
          >
            Send invitation
          </MutationButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function VolunteerRoster({
  eventId,
  onChange,
}: {
  eventId: string;
  onChange?: () => void;
}) {
  const load = useCallback(
    async () =>
      readResponse(
        await client.volunteers[":eventId"].$get({ param: { eventId } }),
      ),
    [eventId],
  );
  const loadEvents = useCallback(
    async () => readResponse(await client.events.$get()),
    [],
  );
  const roster = useResource(load);
  const events = useResource(loadEvents);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [now] = useState(() => Date.now());
  const event = events.data?.find((item) => item.id === eventId);
  const ended = !!event && Date.parse(event.endsAt) <= now;
  const refresh = () => {
    roster.retry();
    onChange?.();
  };
  const searched = searchRows(roster.data ?? [], search, events.data ?? []);
  const rows = searched.filter((row) => matchesGroup(row, group));
  return (
    <Section
      plain
      title="Volunteer roster"
      description="Review applications and track duties. Students respond to invitations themselves."
      action={
        <InviteVolunteer
          eventId={eventId}
          onChange={refresh}
          disabled={!event || ended || roster.isLoading || !!roster.error}
        />
      }
    >
      <div className="space-y-5">
        {ended ? (
          <p className="text-sm text-muted-foreground">
            This event has ended. You can still view volunteer records and duty
            history.
          </p>
        ) : null}
        <ResourceContent resource={events}>{null}</ResourceContent>
        <VolunteerFilters
          search={search}
          setSearch={setSearch}
          group={group}
          setGroup={setGroup}
          rows={searched}
        />
        <ResourceContent resource={roster}>
          <div className="space-y-4">
            <ResultsSummary
              count={rows.length}
              filtered={!!search || group !== "all"}
              clear={() => {
                setSearch("");
                setGroup("all");
              }}
            />
            <VolunteerCards
              rows={rows}
              events={events.data ?? []}
              showEvent={false}
              onChange={refresh}
            />
          </div>
        </ResourceContent>
      </div>
    </Section>
  );
}
