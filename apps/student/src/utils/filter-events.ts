import client from "@festhub/frontend/api";
import { InferResponseType } from "hono";

type Event = InferResponseType<(typeof client)["events"]["$get"], 200>[number];

type Params = {
  events: Event[];
};

export const filterEvents = ({ events }: Params) => {
  const pastEvents: Event[] = [];
  const upcomingEvents: Event[] = [];
  const onGoingEvents: Event[] = [];

  const now = new Date();

  events.forEach((event) => {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);

    if (endsAt < now) {
      pastEvents.push(event);
    } else if (startsAt > now) {
      upcomingEvents.push(event);
    } else {
      onGoingEvents.push(event);
    }
  });

  return {
    pastEvents,
    upcomingEvents,
    onGoingEvents,
  };
};
