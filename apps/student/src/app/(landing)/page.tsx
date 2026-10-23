import { Suspense } from "react";
import client from "@/lib/api";
import EventBrowser, { RetryEventsButton } from "../_components/event-browser";
import MaxWidthWrapper from "@/components/max-width-wrapper";

async function HomeContent() {
  let data;
  try {
    const response = await client.events.$get();
    if (!response.ok) throw new Error("Unable to load events");
    data = await response.json();
  } catch {
    // The error view below handles network and API failures.
  }
  if (!data)
    return (
      <MaxWidthWrapper>
        <div className="space-y-3 rounded-md border border-border p-6">
          <h1 className="text-2xl font-semibold">Explore campus events</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            Unable to load events right now. Please try again.
          </p>
          <RetryEventsButton />
        </div>
      </MaxWidthWrapper>
    );
  return <EventBrowser events={data} />;
}
export default function Home() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading events…
        </p>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
