"use client";
import { Button } from "@festhub/ui/components/button";
import { useState } from "react";
import type { InferResponseType } from "hono";
import client from "@/lib/api";
import MaxWidthWrapper from "@/components/max-width-wrapper";
import EventCard from "@/components/event-card";
import { EmptyState } from "@festhub/frontend/ui";
import Banner from "./banner";

export default function EventBrowser({
  events,
}: {
  events: InferResponseType<typeof client.events.$get, 200>;
}) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [now] = useState(() => Date.now());
  const filtered = events
    .filter(
      (event) =>
        event.isActive &&
        new Date(event.endsAt).getTime() > now &&
        (selectedType === "All" || event.type === selectedType.toLowerCase()) &&
        [event.title, event.description, event.type, event.venue?.title].some(
          (value) => value?.toLowerCase().includes(search.trim().toLowerCase()),
        ),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  return (
    <>
      <Banner
        search={search}
        onSearch={setSearch}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />
      <MaxWidthWrapper>
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl tracking-tight font-bold">
              Upcoming Events
            </h2>
            <p className="text-muted-foreground text-sm tracking-wide">
              Latest events coming to PUB campus!
            </p>
          </div>
          {filtered.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((event) => (
                <EventCard key={event.id} data={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matching events"
              description="Try another search or category. New events will appear here when published."
            />
          )}
        </section>
      </MaxWidthWrapper>
    </>
  );
}

export function RetryEventsButton() {
  return (
    <Button variant="outline" onClick={() => window.location.reload()}>
      Reload events
    </Button>
  );
}
