import MaxWidthWrapper from "@/components/max-width-wrapper";
import client from "@/lib/api";
import { formatDateTime } from "@/utils/format-date-time";
import { Button } from "@festhub/ui/components/button";
import { ArrowLeft, CalendarClockIcon, MapPinIcon } from "@festhub/ui/icons";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import VolunteerCard from "./_components/volunteer-card";

type Props = {
  params: Promise<{ id: string }>;
};

async function EventContent({ params }: Props) {
  const { id } = await params;

  const response = await client.events[":id"].$get({ param: { id } });

  if (!response.ok) notFound();

  const event = await response.json();

  return (
    <div>
      <div className="h-80 w-full relative flex items-center mb-8">
        <Button
          asChild
          variant={"secondary"}
          size={"icon-sm"}
          className="absolute top-0 left-0 mt-3 ml-3 rounded-full"
        >
          <Link href={"/"}>
            <ArrowLeft />
            <span className="sr-only">Events</span>
          </Link>
        </Button>

        <div className="absolute h-full w-full -z-10 rounded-md overflow-hidden">
          <div className="relative w-full h-full">
            <Image
              src={"/pub_campus.png"}
              fill
              alt="campus"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-r from-primary to-transparent"></div>
          </div>
        </div>

        <div className="px-10 text-primary-foreground space-y-6">
          <h1 className="text-primary-foreground text-6xl font-black">
            {event.title}
          </h1>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPinIcon />
              <span>{event.venueId}</span>
            </div>

            <div className="flex items-center gap-2">
              <CalendarClockIcon />
              <span>{formatDateTime(event.startsAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-5">
        <div className="border border-border shadow-sm flex-1 px-10 py-6 space-y-3 rounded-md">
          <h2 className="text-2xl font-bold tracking-tight">Description</h2>
          <p>{event.description}</p>
        </div>

        <div className="max-w-100 w-full">
          {event.volunteerRegistration === "open" && (
            <VolunteerCard event={event} />
          )}
        </div>
      </div>
    </div>
  );
}

export default async function EventDetails({ params }: Props) {
  return (
    <MaxWidthWrapper>
      <Suspense fallback="Loading...">
        <EventContent params={params} />
      </Suspense>
    </MaxWidthWrapper>
  );
}
