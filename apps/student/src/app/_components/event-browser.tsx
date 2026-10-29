"use client";
import { Button } from "@festhub/ui/components/button";
import { PropsWithChildren, useState } from "react";
import type { InferResponseType } from "hono";
import client from "@/lib/api";
import MaxWidthWrapper from "@/components/max-width-wrapper";
import EventCard from "@/components/event-card";
import { EmptyState } from "@festhub/frontend/ui";
import Banner from "./banner";
import { filterEvents } from "@/utils/filter-events";

const EventWrapper: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {children}
    </div>
  );
};

const EventSection: React.FC<{
  events: InferResponseType<(typeof client)["events"]["$get"], 200>;
  title: string;
  subtitle: string;
}> = ({ events, title, subtitle }) => {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl tracking-tight font-bold">{title}</h2>
        <p className="text-muted-foreground text-sm tracking-wide">
          {subtitle}
        </p>
      </div>

      <EventWrapper>
        {events.map((event) => (
          <EventCard key={event.id} data={event} />
        ))}
      </EventWrapper>
    </section>
  );
};

export default function EventBrowser({
  events,
}: {
  events: InferResponseType<typeof client.events.$get, 200>;
}) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  const { pastEvents, upcomingEvents, onGoingEvents } = filterEvents({
    events,
  });

  return (
    <>
      <Banner
        search={search}
        onSearch={setSearch}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />
      <MaxWidthWrapper className="space-y-8">
        <EventSection
          title="Upcoming Events"
          subtitle="Latest events coming to PUB campus!"
          events={upcomingEvents}
        />

        <EventSection
          title="Ongoing Events"
          subtitle="Events that are happening right now"
          events={onGoingEvents}
        />

        <EventSection
          title="Past Events"
          subtitle="Events that the students already enjoyed"
          events={pastEvents}
        />

        {!pastEvents.length &&
          !upcomingEvents.length &&
          !onGoingEvents.length && (
            <EmptyState
              title="No matching events"
              description="Try another search or category. New events will appear here when published."
            />
          )}
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
