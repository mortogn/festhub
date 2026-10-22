"use client";

import { formatDateTime } from "@/utils/format-date-time";
import { Button } from "@festhub/ui/components/button";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  HandHeartIcon,
  UsersIcon,
} from "@festhub/ui/icons";
import Link from "next/link";
import { useState } from "react";
import { useProfileData } from "./_components/profile-data";
import { EmptyState, ResourceContent, StatusBadge } from "./_components/profile-ui";
import { getInitials, getTeamMembers, getTeamStatus } from "./_components/profile-utils";
import UpcomingVolunteerDuties from "./_components/upcoming-volunteer-duties";

export default function ProfilePage() {
  const { user, student, teams } = useProfileData();
  const [now] = useState(() => Date.now());
  const upcomingEvents = (student.data?.events ?? [])
    .filter((event) => new Date(event.endsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const currentTeams = (teams.data ?? [])
    .filter(({ event }) => !event || new Date(event.endsAt).getTime() > now)
    .sort((a, b) => a.team.name.localeCompare(b.team.name));

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {user.name}</h1>
        <p className="text-sm text-muted-foreground">Your next events, volunteer duties, and teams.</p>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Your upcoming events</h2>
              <Button asChild variant="link" size="sm">
                <Link href="/">Browse events<ArrowRightIcon /></Link>
              </Button>
            </div>
            <ResourceContent resource={student}>
              {upcomingEvents.length === 0 ? (
                <EmptyState title="No upcoming events" description="Your upcoming event registrations will appear here." href="/" action="Browse events" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcomingEvents.map((event) => (
                    <article key={event.id} className="flex flex-col gap-5 rounded-md border border-border p-6 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="rounded-md bg-secondary p-3 text-secondary-foreground">
                          <CalendarClockIcon aria-hidden="true" className="size-5" />
                        </div>
                        <StatusBadge status={event.joinStatus} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-base font-medium">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.startsAt).getTime() <= now ? "In progress" : "Starts"}
                        </p>
                        <time dateTime={event.startsAt} className="block text-sm font-semibold">{formatDateTime(event.startsAt)}</time>
                      </div>
                      <Button asChild variant="secondary" className="w-full">
                        <Link href={`/events/${event.id}`}>View details<ArrowRightIcon /></Link>
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </ResourceContent>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Current teams</h2>
              <Button asChild variant="link" size="sm">
                <Link href="/profile/teams">View teams<ArrowRightIcon /></Link>
              </Button>
            </div>
            <ResourceContent resource={teams}>
              {currentTeams.length === 0 ? (
                <EmptyState title="No current teams" description="Create a team for an upcoming event or check your team invitations." href="/teams/create" action="Create a team" />
              ) : (
                <div className="space-y-4">
                  {currentTeams.map(({ team, event, teammates }) => {
                    const members = getTeamMembers(teammates);
                    const names = members.slice(0, 3).map((member) => member.name || "Unknown member");

                    return (
                      <article key={team.id} className="space-y-4 rounded-md border border-border p-6 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-md bg-secondary p-3 text-secondary-foreground">
                              <UsersIcon aria-hidden="true" className="size-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <h3 className="text-base font-medium">{team.name}</h3>
                              <p className="text-sm text-muted-foreground">{event?.title ?? "Event unavailable"}</p>
                            </div>
                          </div>
                          <StatusBadge status={getTeamStatus(team)} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex shrink-0 -space-x-2" aria-hidden="true">
                              {members.slice(0, 3).map((member, index) => (
                                <div key={`${member.id}-${index}`} className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs font-medium">
                                  {getInitials(member.name ?? "Unknown member")}
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {names.length ? names.join(", ") : "No member information"}
                              {members.length > 3 && ` +${members.length - 3} more`}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{team.leaderId === user.id ? "Team leader" : "Member"}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </ResourceContent>
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href="/profile/team-invites">View team invitations<ArrowRightIcon /></Link>
            </Button>
          </section>
        </div>

        <section className="min-w-0 space-y-6 rounded-md border border-border p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-4 text-secondary-foreground">
              <HandHeartIcon aria-hidden="true" className="size-6" />
            </div>
            <div>
              <h2 className="text-base font-medium">Upcoming volunteer duties</h2>
              <p className="text-sm text-muted-foreground">Your next confirmed duties</p>
            </div>
          </div>
          <ResourceContent resource={student}>
            {student.data && <UpcomingVolunteerDuties events={student.data.volunteerEvents} now={now} />}
          </ResourceContent>
        </section>
      </div>
    </>
  );
}
