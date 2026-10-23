"use client";
import Link from "next/link";
import { useState } from "react";
import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { MutationButton, PageHeading } from "@festhub/frontend/ui";
import { Button } from "@festhub/ui/components/button";
import { useProfileData } from "../_components/profile-data";
import {
  EmptyState,
  EventDates,
  ProfileSection,
  ResourceContent,
  StatusBadge,
} from "../_components/profile-ui";
import UpcomingVolunteerDuties from "../_components/upcoming-volunteer-duties";

export default function VolunteeringPage() {
  const { student } = useProfileData();
  const [now] = useState(() => Date.now());
  const entries = [...(student.data?.volunteerEvents ?? [])].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  return (
    <>
      <PageHeading
        title="My volunteering"
        description="Your invitations, applications, and confirmed volunteer duties."
      />
      <ResourceContent resource={student}>
        {student.data && (
          <ProfileSection
            title="Upcoming duties"
            description="Confirmed duties · Bangladesh time (UTC+06:00)"
          >
            <div className="max-w-xl">
              <UpcomingVolunteerDuties
                events={student.data.volunteerEvents}
                now={now}
              />
            </div>
          </ProfileSection>
        )}
        <h2 className="text-2xl font-bold tracking-tight">
          Invitations and applications
        </h2>
        {!entries.length ? (
          <EmptyState
            title="No volunteering activity"
            description="Explore events to apply as a volunteer."
            href="/"
            action="Browse events"
          />
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {entries.map((event) => (
              <ProfileSection
                key={event.id}
                title={event.title}
                description={
                  event.volunteerType === "invited"
                    ? "Volunteer invitation"
                    : "Volunteer application"
                }
                action={<StatusBadge status={event.volunteerStatus} />}
              >
                <div className="space-y-4">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Event period
                    </p>
                    <EventDates
                      startsAt={event.startsAt}
                      endsAt={event.endsAt}
                    />
                  </div>
                  {event.volunteerType === "invited" &&
                    event.volunteerStatus === "pending" &&
                    new Date(event.endsAt).getTime() > now && (
                      <div className="flex flex-wrap gap-3">
                        {(["accepted", "rejected"] as const).map((action) => (
                          <MutationButton
                            key={action}
                            action={async () =>
                              readResponse(
                                await client.volunteers.invite.$patch({
                                  query: { eventId: event.id },
                                  json: { action },
                                }),
                              )
                            }
                            onSuccess={student.retry}
                          >
                            {action === "accepted"
                              ? "Accept invitation"
                              : "Decline"}
                          </MutationButton>
                        ))}
                      </div>
                    )}
                  <Button asChild variant="link" className="px-0">
                    <Link href={`/events/${event.id}`}>View event</Link>
                  </Button>
                </div>
              </ProfileSection>
            ))}
          </div>
        )}
      </ResourceContent>
    </>
  );
}
