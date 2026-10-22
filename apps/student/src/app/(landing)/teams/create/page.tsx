import client from "@/lib/api";
import { Suspense } from "react";
import CreateTeamForm from "./_form";

type Props = {
  searchParams: Promise<{ eventId?: string }>;
};

async function TeamFormContent({ searchParams }: Props) {
  const { eventId } = await searchParams;
  let events;

  try {
    const response = await client.events.$get();
    if (!response.ok) throw new Error("Unable to load events");
    events = await response.json();
  } catch {
    return (
      <p role="alert" className="text-sm text-destructive">
        Unable to load events. Please refresh the page to try again.
      </p>
    );
  }

  const teamEvents = events.filter((event) => event.isActive && event.teamBased);

  if (teamEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There are no team events available right now.
      </p>
    );
  }

  return (
    <CreateTeamForm
      events={teamEvents}
      initialEventId={
        teamEvents.some((event) => event.id === eventId) ? eventId : undefined
      }
    />
  );
}

export default function CreateTeamPage({ searchParams }: Props) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md rounded-md border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Create a team</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose an event and give your team a name to get started.
          </p>
        </div>

        <Suspense
          fallback={
            <p role="status" className="text-sm text-muted-foreground">
              Loading events…
            </p>
          }
        >
          <TeamFormContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
