"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import client, { readResponse } from "./api";

type RegistrationEvent = { id: string; teamBased: boolean };
type PendingCount =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; count: number };

const eventKey = (event: RegistrationEvent) =>
  `${event.id}:${event.teamBased ? "teams" : "participants"}`;

async function loadPendingCount(event: RegistrationEvent) {
  const param = { id: event.id };
  if (event.teamBased) {
    const teams = await readResponse(
      await client.events[":id"].teams.$get({ param }),
    );
    return teams.filter((team) => team.status === "pending").length;
  }
  const participants = await readResponse(
    await client.events[":id"].participants.$get({ param }),
  );
  return participants.filter(
    (participant) => participant.registrationStatus === "pending",
  ).length;
}

export function usePendingRegistrations(events: RegistrationEvent[]) {
  const [counts, setCounts] = useState<Record<string, PendingCount>>({});
  const requests = useRef(new Map<string, { loading: boolean }>());
  // The descriptor stays stable across rerenders, reordering, and duplicate cards.
  const descriptors = JSON.stringify(
    [
      ...new Map(
        events.map(({ id, teamBased }) => [
          eventKey({ id, teamBased }),
          { id, teamBased },
        ]),
      ).values(),
    ].sort((a, b) => a.id.localeCompare(b.id)),
  );
  const load = useCallback((event: RegistrationEvent) => {
    const key = eventKey(event);
    if (requests.current.get(key)?.loading) return;
    const request = { loading: true };
    requests.current.set(key, request);
    setCounts((previous) => ({ ...previous, [key]: { status: "loading" } }));
    const finish = (result: PendingCount) => {
      // Removed cards, changed registration types, and unmounts invalidate results.
      if (requests.current.get(key) !== request) return;
      request.loading = false;
      setCounts((previous) => ({ ...previous, [key]: result }));
    };
    void loadPendingCount(event).then(
      (count) => finish({ status: "ready", count }),
      () => finish({ status: "error" }),
    );
  }, []);

  useEffect(() => {
    const visible: RegistrationEvent[] = JSON.parse(descriptors);
    const keys = new Set(visible.map(eventKey));
    for (const key of requests.current.keys()) {
      if (!keys.has(key)) requests.current.delete(key);
    }
    for (const event of visible) {
      if (!requests.current.has(eventKey(event))) load(event);
    }
    const refresh = () => {
      for (const event of visible) load(event);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [descriptors, load]);

  useEffect(() => {
    const currentRequests = requests.current;
    return () => currentRequests.clear();
  }, []);

  return {
    getCount: (event: RegistrationEvent) => counts[eventKey(event)],
    retry: load,
  };
}
