import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import client from "@/lib/api";
import MaxWidthWrapper from "@/components/max-width-wrapper";
import { formatDateTime } from "@/utils/format-date-time";
import { Button } from "@festhub/ui/components/button";
import { ArrowLeft, CalendarClockIcon, MapPinIcon } from "@festhub/ui/icons";
import CheckInConfirmation from "./_confirmation";

export const metadata: Metadata = {
  title: "Event check-in | PUB FestHub",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <MaxWidthWrapper>
      <main className="mx-auto my-10 max-w-xl space-y-4 rounded-md border border-border p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p role="alert" className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="secondary">
          <Link href="/">Browse events</Link>
        </Button>
      </main>
    </MaxWidthWrapper>
  );
}

async function CheckInContent({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const qrToken = typeof token === "string" ? token : "";
  const tokenParts = qrToken.split(":");
  if (
    !z.uuid().safeParse(id).success ||
    tokenParts.length !== 3 ||
    tokenParts[0] !== "qr" ||
    tokenParts[1] !== "e" ||
    !z.uuid().safeParse(tokenParts[2]).success
  ) {
    return (
      <Notice
        title="Invalid check-in link"
        message="Scan the event QR again or ask event staff for a new QR."
      />
    );
  }

  const response = await client.events[":id"]
    .$get({ param: { id } })
    .catch(() => null);
  if (!response) {
    return (
      <Notice
        title="Unable to load this event"
        message="Check your connection and scan the event QR again to retry."
      />
    );
  }
  if (!response.ok) {
    return (
      <Notice
        title="Event unavailable"
        message="This event could not be found. Ask event staff to check the QR."
      />
    );
  }
  const event = await response.json().catch(() => null);
  if (!event) {
    return (
      <Notice
        title="Unable to load this event"
        message="Scan the event QR again to retry."
      />
    );
  }
  // Venue names are included in the public event summaries. A failed venue
  // lookup should not prevent a student from confirming their arrival.
  const summaries = await client.events
    .$get()
    .then((result) => (result.ok ? result.json() : []))
    .catch(() => []);
  const venueTitle = summaries.find((item) => item.id === id)?.venue?.title;

  return (
    <MaxWidthWrapper>
      <main className="mx-auto my-8 max-w-xl space-y-6 rounded-md border border-border p-6 shadow-sm sm:my-12 sm:p-8">
        <Link
          href={`/events/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Event details
        </Link>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Event check-in
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
        </div>
        <dl className="space-y-4 text-sm">
          <div className="flex gap-3">
            <CalendarClockIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            />
            <div>
              <dt className="font-medium">Schedule</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDateTime(event.startsAt)}
                <br />
                to {formatDateTime(event.endsAt)}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPinIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            />
            <div>
              <dt className="font-medium">Venue</dt>
              <dd className="mt-1 text-muted-foreground">
                {venueTitle || "Ask event staff for the venue"}
              </dd>
            </div>
          </div>
        </dl>
        <CheckInConfirmation key={id + qrToken} eventId={id} token={qrToken} />
      </main>
    </MaxWidthWrapper>
  );
}

export default function CheckInPage(props: Props) {
  return (
    <Suspense fallback={
      <MaxWidthWrapper>
        <p role="status" className="mx-auto my-10 max-w-xl text-sm text-muted-foreground">
          Loading event check-in…
        </p>
      </MaxWidthWrapper>
    }>
      <CheckInContent {...props} />
    </Suspense>
  );
}
