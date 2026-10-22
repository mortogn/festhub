import client from "@/lib/api";
import React from "react";
import EventCard from "@/components/event-card";

const Events: React.FC = async () => {
  const eventsResponse = await client.events.$get();

  const data = await eventsResponse.json();

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl tracking-tight font-bold">Upcoming Events</h2>
        <p className="text-muted-foreground text-sm tracking-wide">
          Latest events coming to PUB campus!
        </p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {data.map((event) => (
          <EventCard key={event.id} data={event} />
        ))}
      </div>
    </section>
  );
};

export default Events;
