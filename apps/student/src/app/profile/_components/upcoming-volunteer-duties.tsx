"use client";

import client from "@/lib/api";
import { Button } from "@festhub/ui/components/button";
import { ArrowRightIcon } from "@festhub/ui/icons";
import { campusDate } from "@festhub/frontend/dates";
import Link from "next/link";
import { useCallback } from "react";
import { type StudentProfile, useResource } from "./profile-data";
import { EmptyState, ResourceContent, StatusBadge } from "./profile-ui";

type Props = {
  events: StudentProfile["volunteerEvents"];
  now: number;
};

export default function UpcomingVolunteerDuties({ events, now }: Props) {
  const loadDuties = useCallback(async () => {
    const confirmed = events.filter(
      (event) =>
        event.volunteerStatus === "accepted" ||
        event.volunteerStatus === "approved",
    );
    const results = await Promise.allSettled(
      confirmed.map(async (summary) => {
        const response = await client.events[":id"].$get({
          param: { id: summary.id },
        });
        if (!response.ok) throw new Error("Unable to load duty schedule");
        const event = await response.json();
        return {
          ...summary,
          volunteerStartsAt: event.volunteerStartsAt,
          volunteerEndsAt: event.volunteerEndsAt,
        };
      }),
    );

    return {
      duties: results
        .flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        )
        .filter((duty) => {
          if (duty.volunteerEndsAt)
            return new Date(duty.volunteerEndsAt).getTime() > now;
          if (duty.volunteerStartsAt)
            return new Date(duty.volunteerStartsAt).getTime() >= now;
          return new Date(duty.endsAt).getTime() > now;
        })
        .sort((a, b) => {
          const aStart = a.volunteerStartsAt
            ? new Date(a.volunteerStartsAt).getTime()
            : Infinity;
          const bStart = b.volunteerStartsAt
            ? new Date(b.volunteerStartsAt).getTime()
            : Infinity;
          return aStart - bStart;
        }),
      // An old, inactive event may no longer have a public detail page.
      hasUnavailableSchedules: results.some(
        (result, index) =>
          result.status === "rejected" &&
          new Date(confirmed[index]!.endsAt).getTime() > now,
      ),
    };
  }, [events, now]);
  const schedule = useResource(loadDuties);

  return (
    <ResourceContent resource={schedule}>
      {schedule.data?.hasUnavailableSchedules && (
        <div className="mb-5 space-y-2">
          <p role="alert" className="text-sm text-muted-foreground">
            Some volunteer schedules could not be loaded.
          </p>
          <Button variant="outline" size="sm" onClick={schedule.retry}>
            Try again
          </Button>
        </div>
      )}
      {schedule.data?.duties.length === 0 &&
        !schedule.data.hasUnavailableSchedules && (
          <EmptyState
            title="No upcoming volunteer duties"
            description="Your confirmed volunteering duties will appear here."
            href="/"
            action="Explore events"
          />
        )}
      <div className="space-y-5">
        {schedule.data?.duties.map((duty) => {
          const startsAt = duty.volunteerStartsAt
            ? campusDate(duty.volunteerStartsAt)
            : null;
          const hasStarted = startsAt !== null && startsAt.valueOf() <= now;

          return (
            <article
              key={duty.id}
              className="space-y-5 rounded-md border border-border p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-medium">{duty.title}</h3>
                <StatusBadge status={duty.volunteerStatus} />
              </div>
              <div className="rounded-md bg-secondary/50 px-4 py-5 text-center">
                <p className="mb-3 text-xs text-muted-foreground">
                  {hasStarted ? "Duty started" : "Duty starts"}
                </p>
                {startsAt && duty.volunteerStartsAt ? (
                  <time
                    dateTime={duty.volunteerStartsAt}
                    className="block space-y-1"
                  >
                    <span className="block text-sm text-muted-foreground">
                      {startsAt.format("dddd")}
                    </span>
                    <span className="block text-5xl font-semibold tracking-tight">
                      {startsAt.format("DD")}
                    </span>
                    <span className="block text-sm font-medium">
                      {startsAt.format("MMMM YYYY")}
                    </span>
                    <span className="block pt-2 text-xl font-semibold">
                      {startsAt.format("h:mm A")}
                    </span>
                  </time>
                ) : (
                  <p className="text-lg font-semibold">Will be announced</p>
                )}
              </div>
              <Button asChild variant="secondary" className="w-full">
                <Link href={`/events/${duty.id}`}>
                  View event
                  <ArrowRightIcon />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
    </ResourceContent>
  );
}
