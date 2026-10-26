"use client";

import { useCallback, useState } from "react";
import type { InferRequestType, InferResponseType } from "hono";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@festhub/ui/components/tabs";
import client, { readResponse } from "./api";
import { useAuthContext } from "./auth";
import {
  campusDate,
  formatDateTime,
  fromDateInput,
  toDateInput,
} from "./dates";
import { useResource, type Resource } from "./resource";
import { usePendingRegistrations } from "./pending-registrations";
import {
  Editor,
  EmptyState,
  MutationButton,
  PageHeading,
  PersonAvatar,
  SearchInput,
  ResourceContent,
  Section,
  StatusBadge,
  type FieldSpec,
} from "./ui";
import { VolunteerRoster } from "./staff-volunteers";
import { ImageUpload } from "./image-upload";
import { UploadedImage } from "./uploaded-image";
import { DeleteButton } from "./delete-button";
import { QrCodeIcon } from "@festhub/ui/icons";
import { EventAttendanceQr } from "./event-attendance-qr";

type EventRecord = InferResponseType<
  (typeof client.events)[":id"]["$get"],
  200
>;
type Events = InferResponseType<typeof client.events.$get, 200>;
type EventUpdate = InferRequestType<
  (typeof client.events)[":id"]["$put"]
>["json"];
type EventCreate = InferRequestType<typeof client.events.$post>["json"];
const eventTypes = ["workshop", "seminar", "contest"].map((value) => ({
  value,
  label: value[0]!.toUpperCase() + value.slice(1),
}));
const loadEvents = async () => readResponse(await client.events.$get());
const loadStudents = async () => readResponse(await client.students.$get());
const eventHref = (id: string) => `/dashboard/events/${id}`;

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="w-full min-w-0 data-[size=default]:h-11"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EventCards({
  events,
  pendingRegistrations,
  eventMetadata,
}: {
  events: (Pick<Events[number], "id" | "title" | "startsAt" | "endsAt"> &
    Partial<
      Pick<
        Events[number],
        "type" | "isActive" | "teamBased" | "venue" | "thumbnailId"
      >
    >)[];
  pendingRegistrations: ReturnType<typeof usePendingRegistrations>;
  eventMetadata: Resource<Events>;
}) {
  return (
    <div className="@container">
      <div className="grid gap-4 @min-[40rem]:grid-cols-2">
        {events.map((event) => (
          <article
            className="flex min-w-0 flex-col rounded-xl border bg-card p-4 sm:p-5"
            key={event.id}
          >
            {event.thumbnailId && (
              <UploadedImage
                imageId={event.thumbnailId}
                alt={`${event.title} thumbnail`}
                className="mb-4 aspect-video w-full rounded-lg"
              />
            )}
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex w-12 shrink-0 flex-col items-center rounded-lg border bg-muted/30 py-2"
              >
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {campusDate(event.startsAt).format("MMM")}
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {campusDate(event.startsAt).format("DD")}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold break-words">
                  <Link href={eventHref(event.id)} className="hover:underline">
                    {event.title}
                  </Link>
                </h3>
                {event.type && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {event.type}
                    {event.teamBased
                      ? " · Team registration"
                      : " · Individual registration"}
                  </p>
                )}
                <PendingRegistrationIndicator
                  event={event}
                  pendingRegistrations={pendingRegistrations}
                  eventMetadata={eventMetadata}
                />
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <time dateTime={event.startsAt}>
                {formatDateTime(event.startsAt)}
              </time>
              <br />
              to {formatDateTime(event.endsAt)}
            </p>
            {event.venue && (
              <p className="mt-2 text-sm break-words text-muted-foreground">
                {event.venue.title}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              {event.isActive !== undefined && (
                <StatusBadge
                  status={event.isActive ? "published" : "unpublished"}
                />
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <EventAttendanceQr eventId={event.id} title={event.title} />
                <Button asChild variant="outline" size="sm">
                  <Link href={`${eventHref(event.id)}/attendance`}>
                    <QrCodeIcon aria-hidden="true" />
                    Scan Students
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={eventHref(event.id)}>Manage event</Link>
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PendingRegistrationIndicator({
  event,
  pendingRegistrations,
  eventMetadata,
}: {
  event: { id: string; teamBased?: boolean };
  pendingRegistrations: ReturnType<typeof usePendingRegistrations>;
  eventMetadata: Resource<Events>;
}) {
  const resolved =
    typeof event.teamBased === "boolean"
      ? { id: event.id, teamBased: event.teamBased }
      : null;
  const result = resolved ? pendingRegistrations.getCount(resolved) : null;
  const unavailable = resolved
    ? result?.status === "error"
    : !eventMetadata.isLoading;
  if (unavailable) {
    return (
      <p className="text-xs text-muted-foreground">
        Pending count unavailable.{" "}
        <button
          type="button"
          className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Retry pending registration count"
          onClick={() =>
            resolved
              ? pendingRegistrations.retry(resolved)
              : eventMetadata.retry()
          }
        >
          Retry
        </button>
      </p>
    );
  }
  if (!result || result.status === "loading") {
    return (
      <p className="text-xs text-muted-foreground">Checking registrations…</p>
    );
  }
  if (result.status !== "ready" || result.count === 0) return null;
  const label = event.teamBased ? "team" : "participant";
  return (
    <Badge
      variant="secondary"
      className="h-auto max-w-full whitespace-normal bg-amber-500/10 text-amber-700 dark:text-amber-400"
    >
      {result.count} {label}
      {result.count === 1 ? "" : "s"} pending
    </Badge>
  );
}

export function StaffOverview() {
  const [now] = useState(() => Date.now());
  const { user } = useAuthContext();
  const events = useResource(loadEvents);
  const loadRequests = useCallback(
    async () =>
      readResponse(
        await client.volunteers.$get({ query: { filter: "active" } }),
      ),
    [],
  );
  const requests = useResource(loadRequests);
  const loadAssigned = useCallback(async () => {
    if (user?.role !== "teacher") return [];
    const result = await readResponse(
      await client.teachers[":id"].$get({ param: { id: user.id } }),
    );
    return result.flatMap((teacher) => teacher.organizedEvents);
  }, [user]);
  const assigned = useResource(loadAssigned);
  const upcoming = [...(events.data ?? [])]
    .filter((event) => new Date(event.endsAt).getTime() > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 6);
  const organizedEvents = (assigned.data ?? []).map((event) => ({
    ...event,
    ...events.data?.find((item) => item.id === event.id),
  }));
  const pendingRegistrations = usePendingRegistrations(
    [...upcoming, ...organizedEvents].flatMap((event) =>
      typeof event.teamBased === "boolean"
        ? [{ id: event.id, teamBased: event.teamBased }]
        : [],
    ),
  );
  const pending = (requests.data ?? []).filter(
    (request) => request.registrationStatus === "pending",
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title={`Welcome back, ${user?.name ?? "there"}`}
        description="Manage your events, registrations, and volunteer duties."
        action={
          <Button asChild>
            <Link href="/dashboard/events/create">Create event</Link>
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Section
            title="Upcoming events"
            action={
              <Button variant="link" asChild>
                <Link href="/dashboard/events">View all events</Link>
              </Button>
            }
          >
            <ResourceContent resource={events}>
              {upcoming.length ? (
                <EventCards
                  events={upcoming}
                  pendingRegistrations={pendingRegistrations}
                  eventMetadata={events}
                />
              ) : (
                <EmptyState
                  title="No upcoming events"
                  description="Create an event to start planning."
                  href="/dashboard/events/create"
                  action="Create event"
                />
              )}
            </ResourceContent>
          </Section>
          {user?.role === "teacher" && (
            <Section title="Events you organize">
              <ResourceContent resource={assigned}>
                {assigned.data?.length ? (
                  <EventCards
                    events={organizedEvents}
                    pendingRegistrations={pendingRegistrations}
                    eventMetadata={events}
                  />
                ) : (
                  <EmptyState
                    title="No assigned events"
                    description="Your organizer assignments will appear here."
                  />
                )}
              </ResourceContent>
            </Section>
          )}
        </div>
        <Section
          title="Volunteer requests"
          description="Pending applications for upcoming duties."
        >
          <ResourceContent resource={requests}>
            {pending.length ? (
              <div className="space-y-4">
                {pending.slice(0, 5).map((request) => (
                  <div
                    key={`${request.eventId}-${request.student.id}`}
                    className="space-y-1 border-b pb-4 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">{request.student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {events.data?.find(
                        (event) => event.id === request.eventId,
                      )?.title ?? "Event details unavailable"}
                    </p>
                    <StatusBadge status="pending" />
                  </div>
                ))}
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/dashboard/volunteers">
                    Review requests ({pending.length})
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                title="No pending requests"
                description="New volunteer applications will appear here."
              />
            )}
          </ResourceContent>
        </Section>
      </div>
    </div>
  );
}

export function StaffEventsPage() {
  const [now] = useState(() => Date.now());
  const events = useResource(loadEvents);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [state, setState] = useState("all");
  const [period, setPeriod] = useState("upcoming");
  const filtered = [...(events.data ?? [])]
    .filter(
      (event) =>
        event.title.toLowerCase().includes(search.trim().toLowerCase()) &&
        (type === "all" || event.type === type) &&
        (state === "all" || event.isActive === (state === "active")) &&
        (period === "all" ||
          new Date(event.endsAt).getTime() > now === (period === "upcoming")),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const pendingRegistrations = usePendingRegistrations(filtered);
  return (
    <div className="space-y-6">
      <PageHeading
        title="Events"
        description="Plan events and manage registrations in one place."
        action={
          <Button asChild>
            <Link href="/dashboard/events/create">Create event</Link>
          </Button>
        }
      />
      <div className="grid items-end gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label
            htmlFor="event-search"
            className="text-xs text-muted-foreground"
          >
            Search events
          </label>
          <SearchInput
            id="event-search"
            placeholder="Search by event title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <FilterSelect
          label="Event type"
          value={type}
          onChange={setType}
          options={[{ value: "all", label: "All types" }, ...eventTypes]}
        />
        <FilterSelect
          label="Publication"
          value={state}
          onChange={setState}
          options={[
            { value: "all", label: "All events" },
            { value: "active", label: "Published" },
            { value: "inactive", label: "Unpublished" },
          ]}
        />
        <FilterSelect
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "upcoming", label: "Upcoming / ongoing" },
            { value: "past", label: "Past events" },
            { value: "all", label: "All dates" },
          ]}
        />
      </div>
      <ResourceContent resource={events}>
        {filtered.length ? (
          <EventCards
            events={filtered}
            pendingRegistrations={pendingRegistrations}
            eventMetadata={events}
          />
        ) : (
          <EmptyState
            title="No matching events"
            description="Try another search or adjust the filters."
          />
        )}
      </ResourceContent>
    </div>
  );
}

const generalFields: FieldSpec[] = [
  { name: "title", label: "Event title", required: true, fullWidth: true },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "type",
    label: "Event type",
    type: "select",
    options: eventTypes,
    required: true,
  },
  { name: "startsAt", label: "Starts", type: "datetime-local", required: true },
  { name: "endsAt", label: "Ends", type: "datetime-local", required: true },
];
const dateKeys = [
  "startsAt",
  "endsAt",
  "registrationOpensAt",
  "registrationClosesAt",
  "volunteerStartsAt",
  "volunteerEndsAt",
] as const;
const numberKeys = [
  "maxParticipants",
  "maxTeams",
  "minTeamSize",
  "maxTeamSize",
  "maxVolunteers",
] as const;
const dateFields = new Set<string>(dateKeys);
const numericFields = new Set<string>(numberKeys);
const switches = new Set(["teamBased", "isActive"]);
const updateFields = new Set<string>([
  ...dateKeys,
  ...numberKeys,
  ...switches,
  "title",
  "description",
  "type",
  "volunteerRegistration",
]);

export function StaffCreateEventPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeading
        title="Create an event"
        description="Start with the essentials. Add images, configure registration, and publish your event after creating it."
      />
      <Section title="Event details" description="Bangladesh time (UTC+06:00)">
        <Editor
          fields={generalFields}
          initialValues={{
            title: "",
            description: "",
            type: "workshop",
            startsAt: "",
            endsAt: "",
          }}
          submitLabel="Create event"
          onSubmit={async (values) => {
            const startsAt = fromDateInput(values.startsAt!);
            const endsAt = fromDateInput(values.endsAt!);
            if (Date.parse(startsAt) >= Date.parse(endsAt))
              throw new Error("The event must end after it starts.");
            const result = await readResponse(
              await client.events.$post({
                json: {
                  title: values.title!.trim(),
                  description: values.description?.trim(),
                  type: values.type as EventCreate["type"],
                  startsAt,
                  endsAt,
                },
              }),
            );
            router.push(eventHref(result.id));
          }}
        />
      </Section>
    </div>
  );
}

export function StaffEventPage({ id }: { id: string }) {
  const load = useCallback(
    async () =>
      readResponse(await client.events[":id"].$get({ param: { id } })),
    [id],
  );
  const event = useResource(load);
  return (
    <div className="space-y-6">
      <Button asChild variant="link" className="px-0">
        <Link href="/dashboard/events">← All events</Link>
      </Button>
      <ResourceContent resource={event}>
        {event.data && (
          <>
            <PageHeading
              title={event.data.title}
              description={`${formatDateTime(event.data.startsAt)} – ${formatDateTime(event.data.endsAt)}`}
              action={
                <StatusBadge
                  status={event.data.isActive ? "published" : "unpublished"}
                />
              }
            />
            <Tabs defaultValue="configuration" className="space-y-6">
              <div className="overflow-x-auto pb-1">
                <TabsList
                  className="grid w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto"
                  style={{ height: "auto" }}
                >
                  <TabsTrigger value="configuration" style={{ height: 40 }}>
                    Configuration
                  </TabsTrigger>
                  <TabsTrigger value="media" style={{ height: 40 }}>
                    Media
                  </TabsTrigger>
                  <TabsTrigger value="registrations" style={{ height: 40 }}>
                    Registrations
                  </TabsTrigger>
                  <TabsTrigger value="volunteers" style={{ height: 40 }}>
                    Volunteers
                  </TabsTrigger>
                  <TabsTrigger value="organizers" style={{ height: 40 }}>
                    Organizers
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="configuration">
                <EventConfiguration event={event.data} onChange={event.retry} />
              </TabsContent>

              <TabsContent value="media">
                <Section
                  title="Event images"
                  description="Upload each image separately. Image uploads do not save changes in the other sections."
                >
                  <div className="grid items-start gap-6 sm:grid-cols-2">
                    <ImageUpload
                      key={`${event.data.id}-thumbnail`}
                      label="Event thumbnail"
                      target={{
                        type: "event_thumbnail",
                        resourceId: event.data.id,
                      }}
                      currentImageId={event.data.thumbnailId}
                    />
                    <ImageUpload
                      key={`${event.data.id}-banner`}
                      label="Event banner"
                      target={{
                        type: "event_banner",
                        resourceId: event.data.id,
                      }}
                      currentImageId={event.data.bannerId}
                    />
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="registrations">
                {event.data.teamBased ? (
                  <TeamRegistrations eventId={id} />
                ) : (
                  <ParticipantRegistrations event={event.data} />
                )}
              </TabsContent>
              <TabsContent value="volunteers">
                <VolunteerRoster eventId={id} />
              </TabsContent>
              <TabsContent value="organizers">
                <EventOrganizers key={id} eventId={id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </ResourceContent>
    </div>
  );
}

function initialConfiguration(event: EventRecord): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of Object.keys(event) as (keyof EventRecord)[]) {
    const value = event[key];
    values[key] = dateFields.has(key)
      ? toDateInput(value as string | null)
      : value == null
        ? ""
        : String(value);
  }
  return values;
}

function validateConfiguration(
  event: EventRecord,
  values: Record<string, string>,
) {
  const merged = { ...initialConfiguration(event), ...values };
  for (const key of numberKeys) {
    const value = merged[key];
    if (value && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0))
      throw new Error(
        "Capacities and team sizes must be positive whole numbers.",
      );
  }
  for (const [start, end, label] of [
    ["startsAt", "endsAt", "The event"],
    ["registrationOpensAt", "registrationClosesAt", "Registration"],
    ["volunteerStartsAt", "volunteerEndsAt", "Volunteer duty"],
  ] as const) {
    if (
      merged[start] &&
      merged[end] &&
      Date.parse(fromDateInput(merged[start])) >=
        Date.parse(fromDateInput(merged[end]))
    )
      throw new Error(`${label} must end after it starts.`);
  }
  if (
    merged.minTeamSize &&
    merged.maxTeamSize &&
    Number(merged.minTeamSize) > Number(merged.maxTeamSize)
  )
    throw new Error("Minimum team size cannot exceed maximum team size.");
}

async function checkVenueConflict(
  event: EventRecord,
  startsAt: string,
  endsAt: string,
) {
  if (!event.venueId) return;
  // The availability route rejects historical periods, so use the event list there.
  if (Date.parse(endsAt) <= Date.now()) {
    const events = await loadEvents();
    const blocking = events.filter(
      (item) =>
        item.id !== event.id &&
        item.venue?.id === event.venueId &&
        Date.parse(item.startsAt) < Date.parse(endsAt) &&
        Date.parse(item.endsAt) > Date.parse(startsAt),
    );
    if (blocking.length)
      throw new Error(
        `The assigned venue conflicts with ${blocking.map((item) => item.title).join(", ")}. Choose another time or venue.`,
      );
  } else {
    const venues = await readResponse(
      await client.venues.available.$get({ query: { startsAt, endsAt } }),
    );
    const venue = venues.find((item) => item.id === event.venueId);
    const blocking =
      venue?.blockingEvents.filter((item) => item.id !== event.id) ?? [];
    if (blocking.length)
      throw new Error(
        `The assigned venue conflicts with ${blocking.map((item) => item.title).join(", ")}. Choose another time or venue.`,
      );
  }
}

function buildEventUpdate(
  event: EventRecord,
  values: Record<string, string>,
): EventUpdate {
  validateConfiguration(event, values);
  const initialValues = initialConfiguration(event);
  const changed: Record<string, string | boolean | number> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!updateFields.has(key)) continue;
    if (value === initialValues[key]) continue;
    if ((dateFields.has(key) || numericFields.has(key)) && !value) {
      if (initialValues[key])
        throw new Error(
          "An existing date or capacity cannot be cleared by the API. Enter a new value or keep the current one.",
        );
      continue;
    }
    changed[key] = dateFields.has(key)
      ? fromDateInput(value)
      : numericFields.has(key)
        ? Number(value)
        : switches.has(key)
          ? value === "true"
          : key === "title"
            ? value.trim()
            : value;
  }
  if (!Object.keys(changed).length) throw new Error("No changes to save.");
  return changed as EventUpdate;
}

function EventConfiguration({
  event,
  onChange,
}: {
  event: EventRecord;
  onChange: () => void;
}) {
  const initialValues = initialConfiguration(event);
  const save = async (values: Record<string, string>) => {
    const changed = buildEventUpdate(event, values);
    if (changed.startsAt || changed.endsAt)
      await checkVenueConflict(
        event,
        String(changed.startsAt ?? event.startsAt),
        String(changed.endsAt ?? event.endsAt),
      );
    await readResponse(
      await client.events[":id"].$put({
        param: { id: event.id },
        json: changed,
      }),
    );
    onChange();
  };
  const registrationFields: FieldSpec[] = [
    {
      name: "registrationOpensAt",
      label: "Registration opens",
      type: "datetime-local",
    },
    {
      name: "registrationClosesAt",
      label: "Registration closes",
      type: "datetime-local",
    },
    {
      name: "teamBased",
      label: "Team-based event",
      type: "switch",
      description: "Enable before students create teams for this event.",
    },
    {
      name: "maxParticipants",
      label: "Maximum participants",
      type: "number",
      min: 1,
      description: "Used for individual registration.",
    },
    {
      name: "maxTeams",
      label: "Maximum teams",
      type: "number",
      min: 1,
      description: "Used for team registration.",
    },
    { name: "minTeamSize", label: "Minimum team size", type: "number", min: 1 },
    { name: "maxTeamSize", label: "Maximum team size", type: "number", min: 1 },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Schedule fields use Bangladesh time (UTC+06:00). Save each section
        separately.
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Section title="Event details">
          <Editor
            persistentErrors
            fields={[
              ...generalFields,
              {
                name: "isActive",
                label: "Publish event",
                type: "switch",
                description: "Published events are visible to students.",
              },
            ]}
            initialValues={initialValues}
            onSubmit={save}
            submitLabel="Save event details"
          />
        </Section>
        <Section
          title="Registration"
          description="Set both opening and closing dates to allow individual registration."
        >
          <Editor
            persistentErrors
            fields={registrationFields}
            initialValues={initialValues}
            onSubmit={save}
            submitLabel="Save registration settings"
          />
        </Section>
        <Section
          title="Volunteering"
          description="Set both duty timestamps before inviting or approving volunteers."
        >
          <Editor
            persistentErrors
            fields={[
              {
                name: "volunteerRegistration",
                label: "Volunteer applications",
                type: "select",
                options: [
                  { value: "closed", label: "Closed" },
                  { value: "open", label: "Open" },
                ],
              },
              {
                name: "volunteerStartsAt",
                label: "Duty starts",
                type: "datetime-local",
              },
              {
                name: "volunteerEndsAt",
                label: "Duty ends",
                type: "datetime-local",
              },
              {
                name: "maxVolunteers",
                label: "Maximum volunteers",
                type: "number",
                min: 1,
              },
            ]}
            initialValues={{
              ...initialValues,
              volunteerRegistration: event.volunteerRegistration ?? "closed",
            }}
            onSubmit={save}
            submitLabel="Save volunteer settings"
          />
        </Section>
        <EventVenue event={event} onChange={onChange} />
      </div>
    </div>
  );
}

function EventVenue({
  event,
  onChange,
}: {
  event: EventRecord;
  onChange: () => void;
}) {
  const [now] = useState(() => Date.now());
  const isHistorical = Date.parse(event.endsAt) <= now;
  const load = useCallback(async () => {
    if (Date.parse(event.endsAt) <= Date.now()) {
      const venues = await readResponse(await client.venues.$get());
      const events = await loadEvents();
      return venues.map((venue) => ({
        ...venue,
        blockingEvents: events
          .filter(
            (item) =>
              item.id !== event.id &&
              item.venue?.id === venue.id &&
              Date.parse(item.startsAt) < Date.parse(event.endsAt) &&
              Date.parse(item.endsAt) > Date.parse(event.startsAt),
          )
          .map((item) => ({ id: item.id, title: item.title })),
      }));
    }
    const venues = await readResponse(
      await client.venues.available.$get({
        query: { startsAt: event.startsAt, endsAt: event.endsAt },
      }),
    );
    return venues.map((venue) => ({
      ...venue,
      blockingEvents: venue.blockingEvents.filter(
        (item) => item.id !== event.id,
      ),
    }));
  }, [event.endsAt, event.id, event.startsAt]);
  const venues = useResource(load);
  return (
    <Section
      title="Venue"
      description={`${isHistorical ? "Availability for the historical event period." : "Availability for this event’s saved schedule."} Inactive events also block venues.`}
    >
      <ResourceContent resource={venues}>
        {venues.data?.length ? (
          <div className="space-y-5">
            <Editor
              fields={[
                {
                  name: "venueId",
                  label: "Venue",
                  type: "select",
                  required: true,
                  options: venues.data.map((venue) => ({
                    value: venue.id,
                    label: `${venue.title} (${venue.capacity} seats)${venue.blockingEvents.length ? " — unavailable" : ""}`,
                  })),
                },
              ]}
              initialValues={{ venueId: event.venueId ?? "" }}
              submitLabel="Assign venue"
              onSubmit={async (values) => {
                const venue = venues.data?.find(
                  (item) => item.id === values.venueId,
                );
                if (!venue) throw new Error("Select a venue.");
                if (venue.blockingEvents.length)
                  throw new Error(
                    `This venue is booked for ${venue.blockingEvents.map((item) => item.title).join(", ")}.`,
                  );
                await readResponse(
                  await client.events[":id"].venue.$patch({
                    param: { id: event.id },
                    json: { venueId: venue.id },
                  }),
                );
                onChange();
              }}
            />
            {venues.data.some((venue) => venue.blockingEvents.length) && (
              <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
                {venues.data
                  .filter((venue) => venue.blockingEvents.length)
                  .map((venue) => (
                    <p key={venue.id}>
                      <span className="font-medium text-foreground">
                        {venue.title}:
                      </span>{" "}
                      {venue.blockingEvents
                        .map((item) => item.title)
                        .join(", ")}
                    </p>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No venues yet"
            href="/dashboard/venues"
            action="Manage venues"
          />
        )}
      </ResourceContent>
    </Section>
  );
}

function ParticipantRegistrations({ event }: { event: EventRecord }) {
  const load = useCallback(
    async () =>
      readResponse(
        await client.events[":id"].participants.$get({
          param: { id: event.id },
        }),
      ),
    [event.id],
  );
  const participants = useResource(load);
  const [filter, setFilter] = useState("all");
  const filtered = (participants.data ?? []).filter(
    (item) => filter === "all" || item.registrationStatus === filter,
  );
  const [now] = useState(() => Date.now());
  const ended = Date.parse(event.endsAt) <= now;
  return (
    <Section
      plain
      title="Individual registrations"
      description={
        ended
          ? "This event has ended. Registration reviews are closed."
          : "Review requests below. Accepted registrations cannot be changed."
      }
    >
      <div className="mb-5 max-w-56">
        <FilterSelect
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>
      <ResourceContent resource={participants}>
        {filtered.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((participant) => (
              <article
                key={participant.id}
                className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    name={participant.name}
                    imageId={participant.displayImageId}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/students/${participant.id}`}
                      className="font-semibold break-words hover:underline"
                    >
                      {participant.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {participant.studentId}
                    </p>
                    <p className="mt-1 text-sm break-all text-muted-foreground">
                      {participant.email}
                    </p>
                  </div>
                  <DeleteButton
                    label={`Remove ${participant.name} from ${event.title}`}
                    title="Remove this participant?"
                    description={`Are you sure you want to remove ${participant.name} from ${event.title}? Their registration and check-in record for this event will be permanently deleted. This action cannot be reversed.`}
                    action={async () =>
                      readResponse(
                        await client.participants[":id"].$delete({
                          param: { id: participant.id },
                          query: { eventId: event.id },
                        }),
                      )
                    }
                    onSuccess={participants.retry}
                    successMessage={`${participant.name} removed from ${event.title}.`}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {participant.department} · Batch {participant.batch}
                  </p>
                  <StatusBadge status={participant.registrationStatus} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {participant.checkedInAt
                    ? `Checked in ${formatDateTime(participant.checkedInAt)}`
                    : "Not checked in"}
                </p>
                <div className="mt-4 border-t pt-3">
                  {!ended && participant.registrationStatus !== "accepted" ? (
                    <div className="flex gap-2">
                      <MutationButton
                        action={async () =>
                          readResponse(
                            await client.events[":id"].participants.$patch({
                              param: { id: event.id },
                              json: {
                                studentId: participant.id,
                                action: "accepted",
                              },
                            }),
                          )
                        }
                        onSuccess={participants.retry}
                      >
                        Accept
                      </MutationButton>
                      {participant.registrationStatus === "pending" && (
                        <MutationButton
                          variant="outline"
                          confirm={`Reject ${participant.name}’s registration?`}
                          action={async () =>
                            readResponse(
                              await client.events[":id"].participants.$patch({
                                param: { id: event.id },
                                json: {
                                  studentId: participant.id,
                                  action: "rejected",
                                },
                              }),
                            )
                          }
                          onSuccess={participants.retry}
                        >
                          Reject
                        </MutationButton>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching registrations"
            description="Student registration requests will appear here."
          />
        )}
      </ResourceContent>
    </Section>
  );
}

function TeamRegistrations({ eventId }: { eventId: string }) {
  const load = useCallback(
    async () =>
      readResponse(
        await client.events[":id"].teams.$get({ param: { id: eventId } }),
      ),
    [eventId],
  );
  const teams = useResource(load);
  const students = useResource(loadStudents);
  const [filter, setFilter] = useState("all");
  const filtered = (teams.data ?? []).filter(
    (team) => filter === "all" || team.status === filter,
  );
  return (
    <Section
      plain
      title="Submitted teams"
      description="Draft teams are not listed. Review each team as a group. A completed team review cannot be changed."
    >
      <div className="mb-5 max-w-56">
        <FilterSelect
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
      </div>
      {students.error && (
        <div role="alert" className="mb-4 text-sm text-muted-foreground">
          Member names could not be loaded. Email addresses and student numbers
          are shown.{" "}
          <Button variant="link" onClick={students.retry}>
            Retry names
          </Button>
        </div>
      )}
      <ResourceContent resource={teams}>
        {filtered.length ? (
          <div className="space-y-5">
            {filtered.map((team) => (
              <article
                key={team.id}
                className="space-y-5 rounded-md border border-border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{team.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Submitted{" "}
                      {team.registeredAt
                        ? formatDateTime(team.registeredAt)
                        : "—"}
                    </p>
                  </div>
                  <StatusBadge status={team.status} />
                </div>
                <div className="space-y-3 border-t pt-4">
                  {team.members
                    .filter(
                      (member) => member.id || member.email || member.studentId,
                    )
                    .map((member, index) => (
                      <div
                        key={member.id ?? index}
                        className="flex flex-wrap justify-between gap-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {students.data?.find(
                              (student) => student.id === member.id,
                            )?.name ??
                              member.email ??
                              member.studentId ??
                              "Student"}
                            {member.id === team.leaderId && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                Team leader
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground">
                            {member.studentId} · {member.department} ·{" "}
                            {member.batch}
                          </p>
                        </div>
                        {member.id && (
                          <Button asChild variant="link" size="sm">
                            <Link href={`/dashboard/students/${member.id}`}>
                              View student
                            </Link>
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
                {team.status === "pending" && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <MutationButton
                      confirm={`Accept ${team.name}’s registration? This review cannot be changed later.`}
                      action={async () =>
                        readResponse(
                          await client.events[":eventId"].teams[
                            ":teamId"
                          ].$patch({
                            param: { eventId, teamId: team.id },
                            json: { action: "accepted" },
                          }),
                        )
                      }
                      onSuccess={teams.retry}
                    >
                      Accept team
                    </MutationButton>
                    <MutationButton
                      variant="outline"
                      confirm={`Reject ${team.name}’s registration? This review cannot be changed later.`}
                      action={async () =>
                        readResponse(
                          await client.events[":eventId"].teams[
                            ":teamId"
                          ].$patch({
                            param: { eventId, teamId: team.id },
                            json: { action: "rejected" },
                          }),
                        )
                      }
                      onSuccess={teams.retry}
                    >
                      Reject team
                    </MutationButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No matching submitted teams"
            description="Teams appear after their leaders submit them for registration."
          />
        )}
      </ResourceContent>
    </Section>
  );
}

function EventOrganizers({ eventId }: { eventId: string }) {
  const { user } = useAuthContext();
  const [search, setSearch] = useState("");
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const loadOrganizers = useCallback(
    async () =>
      readResponse(
        await client.organizers[":eventId"].$get({ param: { eventId } }),
      ),
    [eventId],
  );
  const loadTeachers = useCallback(
    async () => readResponse(await client.teachers.$get()),
    [],
  );
  const organizers = useResource(loadOrganizers);
  const teachers = useResource(loadTeachers);
  const query = search.trim().toLowerCase();
  const teacherRows = (teachers.data ?? []).map((teacher) => {
    const organizer = organizers.data?.find(
      (organizer) => organizer.id === teacher.id,
    );
    // Teacher endpoints omit names. Use known names, then fall back to email.
    const name =
      organizer?.name ??
      (user?.id === teacher.id ? user.name : null) ??
      teacher.email;
    return {
      ...teacher,
      name,
      assigned: Boolean(organizer) || assignedIds.includes(teacher.id),
    };
  });
  const filteredTeachers = teacherRows.filter((teacher) =>
    [teacher.name, teacher.teacherId, teacher.email].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );
  const organizerRows = [
    ...(organizers.data ?? []),
    ...teacherRows.filter(
      (teacher) =>
        assignedIds.includes(teacher.id) &&
        !organizers.data?.some((organizer) => organizer.id === teacher.id),
    ),
  ];
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Section title="Organizers">
        <ResourceContent resource={organizers}>
          {organizerRows.length ? (
            <div className="space-y-3">
              {organizerRows.map((organizer) => (
                <article
                  key={organizer.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border p-3 sm:p-4"
                >
                  <PersonAvatar
                    name={organizer.name}
                    imageId={organizer.displayImageId}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      className="font-medium break-words hover:underline"
                      href={`/dashboard/teachers/${organizer.id}`}
                    >
                      {organizer.name}
                    </Link>
                    <p className="text-sm break-words text-muted-foreground">
                      {organizer.teacherId}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No organizers assigned"
              description="Assign a teacher to organize this event."
            />
          )}
        </ResourceContent>
      </Section>
      <Section
        title="Teachers"
        description="Assign teachers to organize this event."
      >
        <div className="space-y-4">
          <SearchInput
            aria-label="Search teachers"
            placeholder="Search by name, teacher ID, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ResourceContent resource={teachers}>
            <ResourceContent resource={organizers}>
              {filteredTeachers.length ? (
                <div className="space-y-3">
                  {filteredTeachers.map((teacher) => (
                    <article
                      className="flex min-w-0 items-center gap-3 rounded-xl border p-3 sm:p-4"
                      key={teacher.id}
                    >
                      <PersonAvatar
                        name={teacher.name}
                        imageId={teacher.displayImageId}
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          className="font-medium break-words hover:underline"
                          href={`/dashboard/teachers/${teacher.id}`}
                        >
                          {teacher.name}
                        </Link>
                        <p className="text-sm break-words text-muted-foreground">
                          {teacher.teacherId}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {teacher.assigned ? (
                          <Button variant="outline" disabled>
                            Assigned
                          </Button>
                        ) : (
                          <MutationButton
                            variant="default"
                            successMessage="Teacher assigned to this event."
                            action={async () =>
                              readResponse(
                                await client.organizers.assign.$post({
                                  json: { eventId, teacherId: teacher.id },
                                }),
                              )
                            }
                            onSuccess={() =>
                              setAssignedIds((ids) => [...ids, teacher.id])
                            }
                          >
                            Assign
                            <span className="sr-only"> {teacher.name}</span>
                          </MutationButton>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    query ? "No matching teachers" : "No teachers available"
                  }
                  description={
                    query
                      ? "Try a different name, teacher ID, or email."
                      : "Teachers will appear here after they finish signing up."
                  }
                />
              )}
            </ResourceContent>
          </ResourceContent>
        </div>
      </Section>
    </div>
  );
}
