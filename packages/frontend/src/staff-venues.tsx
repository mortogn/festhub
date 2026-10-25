"use client";

import { useCallback, useRef, useState } from "react";
import type { InferResponseType } from "hono";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@festhub/ui/components/dialog";
import { MapPinIcon, UsersIcon } from "@festhub/ui/icons";
import client, { readResponse } from "./api";
import { formatDateTime, fromDateInput } from "./dates";
import { useResource } from "./resource";
import { ImageUpload } from "./image-upload";
import { UploadedImage } from "./uploaded-image";
import {
  Editor,
  EmptyState,
  PageHeading,
  ResourceContent,
  SearchInput,
  Section,
  StatusBadge,
  type FieldSpec,
} from "./ui";

type Venue = InferResponseType<typeof client.venues.$get, 200>[number];
type Availability = InferResponseType<typeof client.venues.available.$get, 200>;
const venueTypes = [
  { value: "LAB", label: "Lab" },
  { value: "seminar", label: "Seminar room" },
  { value: "classroom", label: "Classroom" },
  { value: "auditorium", label: "Auditorium" },
];
const venueFields: FieldSpec[] = [
  { name: "title", label: "Venue name", required: true, max: 55 },
  { name: "description", label: "Description", type: "textarea" },
  {
    name: "type",
    label: "Type",
    type: "select",
    required: true,
    options: venueTypes,
  },
  {
    name: "capacity",
    label: "Capacity",
    type: "number",
    min: 1,
    required: true,
  },
];

export function StaffVenuesPage() {
  const load = useCallback(
    async () => readResponse(await client.venues.$get()),
    [],
  );
  const resource = useResource(load);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState<Venue | "new" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [availability, setAvailability] = useState<{
    rows: Availability;
    startsAt: string;
    endsAt: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const venues = (resource.data ?? []).filter((venue) =>
    [
      venue.title,
      venue.description ?? "",
      venueTypes.find((type) => type.value === venue.type)?.label ?? venue.type,
    ].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  const current = editing && editing !== "new" ? editing : null;
  async function saveVenue(values: Record<string, string>) {
    const capacity = Number(values.capacity);
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new Error("Capacity must be a positive whole number.");
    const title = values.title!.trim();
    if (!title || title.length > 55)
      throw new Error("Venue name must contain 1 to 55 characters.");
    const type = values.type as Venue["type"];
    if (!venueTypes.some((item) => item.value === type))
      throw new Error("Select a venue type.");
    if (current) {
      const changes: {
        title?: string;
        description?: string;
        type?: Venue["type"];
        capacity?: number;
      } = {};
      if (title !== current.title) changes.title = title;
      if (values.description !== (current.description ?? ""))
        changes.description = values.description ?? "";
      if (type !== current.type) changes.type = type;
      if (capacity !== current.capacity) changes.capacity = capacity;
      if (!Object.keys(changes).length)
        throw new Error("Make a change before saving.");
      await readResponse(
        await client.venues[":id"].$put({
          param: { id: current.id },
          json: changes,
        }),
      );
    } else {
      await readResponse(
        await client.venues.$post({
          json: {
            title,
            type,
            capacity,
            ...(values.description ? { description: values.description } : {}),
          },
        }),
      );
    }
    setEditing(null);
    setAvailability(null);
    resource.retry();
  }
  return (
    <div className="space-y-6">
      <PageHeading
        title="Venues"
        description="Manage campus spaces and check availability before assigning an event. Edit a saved venue to add its thumbnail."
        action={
          <Button
            onClick={(event) => {
              editTrigger.current = event.currentTarget;
              setEditing("new");
            }}
          >
            Create venue
          </Button>
        }
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !uploading) setEditing(null);
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
          onEscapeKeyDown={(event) => {
            if (uploading) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (uploading) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {current ? "Edit venue" : "Create a venue"}
            </DialogTitle>
            <DialogDescription>
              {current
                ? "Edit the venue details or upload its thumbnail separately."
                : "Set the name, type, and capacity. After creating the venue, choose Edit to add a thumbnail."}
            </DialogDescription>
          </DialogHeader>
          {current && (
            <div className="border-b pb-5">
              <ImageUpload
                key={current.id}
                label="Venue thumbnail"
                target={{ type: "venue_thumbnail", resourceId: current.id }}
                currentImageId={current.thumbnailId}
                onBusyChange={setUploading}
                onUploaded={(id) => {
                  setEditing((venue) =>
                    venue && venue !== "new"
                      ? { ...venue, thumbnailId: id }
                      : venue,
                  );
                  resource.retry();
                }}
              />
            </div>
          )}
          {editing && (
            <fieldset disabled={uploading} className="min-w-0">
              <Editor
                key={current?.id ?? "new"}
                fields={venueFields}
                initialValues={
                  current
                    ? {
                        title: current.title,
                        description: current.description ?? "",
                        type: current.type,
                        capacity: String(current.capacity),
                      }
                    : { type: "LAB" }
                }
                onSubmit={saveVenue}
                submitLabel={current ? "Save changes" : "Create venue"}
                successMessage={current ? "Venue updated." : "Venue created."}
              />
            </fieldset>
          )}
        </DialogContent>
      </Dialog>
      <SearchInput
        aria-label="Search venues"
        placeholder="Search venues or room types"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="w-full sm:max-w-md"
      />
      <ResourceContent resource={resource}>
        {venues.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {venues.map((venue) => (
              <article
                key={venue.id}
                className="flex min-w-0 flex-col rounded-xl border bg-card p-4 sm:p-5"
              >
                {venue.thumbnailId && (
                  <UploadedImage
                    imageId={venue.thumbnailId}
                    alt={`${venue.title} thumbnail`}
                    className="mb-4 aspect-video w-full rounded-lg"
                  />
                )}
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <MapPinIcon
                      aria-hidden="true"
                      className="size-5 text-muted-foreground"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold break-words">{venue.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {venueTypes.find((type) => type.value === venue.type)
                        ?.label ?? venue.type}
                    </p>
                  </div>
                </div>
                {venue.description && (
                  <p className="mt-3 text-sm leading-relaxed break-words text-muted-foreground">
                    {venue.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UsersIcon aria-hidden="true" className="size-4" />
                    {venue.capacity} seats
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      editTrigger.current = event.currentTarget;
                      setEditing(venue);
                    }}
                  >
                    Edit<span className="sr-only"> {venue.title}</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={search ? "No matching venues" : "No venues yet"}
            description={
              search
                ? "Try a different name or room type."
                : "Create a campus venue to start assigning event spaces."
            }
          />
        )}
      </ResourceContent>
      <Section
        title="Check availability"
        description="Bangladesh time (UTC+06:00). All overlapping events, including unpublished events, reserve their venue."
      >
        <div className="max-w-xl">
          <Editor
            fields={[
              {
                name: "startsAt",
                label: "Starts",
                type: "datetime-local",
                required: true,
              },
              {
                name: "endsAt",
                label: "Ends",
                type: "datetime-local",
                required: true,
              },
            ]}
            submitLabel="Check availability"
            successMessage="Availability updated."
            onSubmit={async (values) => {
              setAvailability(null);
              const startsAt = fromDateInput(values.startsAt!);
              const endsAt = fromDateInput(values.endsAt!);
              if (Date.parse(startsAt) >= Date.parse(endsAt))
                throw new Error("End time must be after start time.");
              if (Date.parse(endsAt) <= Date.now())
                throw new Error(
                  "The availability period must end in the future.",
                );
              const rows = await readResponse(
                await client.venues.available.$get({
                  query: { startsAt, endsAt },
                }),
              );
              setAvailability({ rows, startsAt, endsAt });
            }}
          />
        </div>
        {availability && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatDateTime(availability.startsAt)} –{" "}
              {formatDateTime(availability.endsAt)}
            </p>
            {availability.rows.length ? (
              availability.rows.map((venue) => (
                <div
                  key={venue.id}
                  className="flex flex-wrap justify-between gap-3 rounded-md border p-4"
                >
                  <div>
                    <h3 className="font-medium">{venue.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      Capacity: {venue.capacity}
                    </p>
                    {venue.blockingEvents.length > 0 && (
                      <div className="mt-2 text-sm">
                        <p className="text-muted-foreground">Reserved by:</p>
                        {venue.blockingEvents.map((event) => (
                          <Link
                            key={event.id}
                            className="mr-3 inline-block underline underline-offset-4"
                            href={`/dashboard/events/${event.id}`}
                          >
                            {event.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <StatusBadge
                    status={venue.isAvailable ? "available" : "unavailable"}
                  />
                </div>
              ))
            ) : (
              <EmptyState title="No venues to check" />
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
