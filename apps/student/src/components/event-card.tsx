import client from "@/lib/api";
import { formatDateTime } from "@/utils/format-date-time";
import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CodeIcon,
  HandHeartIcon,
  MapPinIcon,
  UsersIcon,
} from "@festhub/ui/icons";
import { InferResponseType } from "hono";
import Link from "next/link";
import React, { ReactNode } from "react";
import { UploadedImage } from "@festhub/frontend/uploaded-image";
import { cn } from "@festhub/ui/lib/utils";
import { contestUrl } from "@/lib/contests";

type EventsResponse = InferResponseType<(typeof client)["events"]["$get"], 200>;

type EventCardProps = {
  data: EventsResponse[number];
};

const SlideCard: React.FC<{
  text: string;
  icon: ReactNode;
  className?: string;
  href?: string;
}> = ({ text, icon, className, href }) => {
  const classes = cn(
    "absolute mt-3 top-0 right-0 py-1 px-3 z-20 bg-secondary text-secondary-foreground shadow-md border-r border-t border-b border-border flex items-center rounded-l-full group motion-reduce:transition-none",
    href ? "cursor-pointer" : "cursor-default",
    className,
  );
  const label = (
    <span className="text-xs font-medium font-mono tracking-tight ml-0 opacity-0 text-nowrap overflow-hidden max-w-0 group-hover:max-w-100 group-focus-visible:max-w-100 group-hover:ml-1.5 group-focus-visible:ml-1.5 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all duration-300 ease-in-out">
      {text}
    </span>
  );
  return href ? (
    <a href={href} aria-label={text} className={classes}>
      {icon}
      {label}
    </a>
  ) : (
    <button type="button" className={classes}>
      {icon}
      {label}
    </button>
  );
};

const EventCard: React.FC<EventCardProps> = ({ data }) => {
  const now = new Date();
  const contestHref = contestUrl(data.contestSlug);

  const lookingForVolunteer: boolean =
    data.volunteerRegistration === "open" &&
    (!data.volunteerStartsAt || new Date(data.volunteerStartsAt) >= now);

  const registrationOpen: boolean =
    !!data.registrationOpensAt &&
    new Date(data.registrationOpensAt) <= now &&
    (!data.registrationClosesAt || new Date(data.registrationClosesAt) > now);

  return (
    <Card className="mt-0 pt-0 space-y-1 gap-2.5 px-0">
      <div className="relative">
        <UploadedImage
          imageId={data.thumbnailId}
          alt={`${data.title} thumbnail`}
          className="aspect-video w-full rounded-t-xl"
        />

        {lookingForVolunteer && (
          <SlideCard
            icon={<HandHeartIcon strokeWidth={1} className="size-5" />}
            text="Looking for Volunteers"
            className="mt-3"
          />
        )}

        {registrationOpen && (
          <SlideCard
            className={lookingForVolunteer ? "mt-12" : "mt-3"}
            icon={<UsersIcon strokeWidth={1} className="size-5" />}
            text="Registration open"
          />
        )}

        {contestHref && (
          <SlideCard
            href={contestHref}
            className={
              ["mt-3", "mt-12", "mt-21"][
                Number(lookingForVolunteer) + Number(registrationOpen)
              ]
            }
            icon={<CodeIcon strokeWidth={1} className="size-5" />}
            text="Programming contest"
          />
        )}
      </div>

      <CardHeader className="mb-0 pb-0">
        <div className="flex gap-1 items-center">
          <Badge variant={"outline"}>{data.type}</Badge>
          <Badge variant={"outline"}>
            {data.teamBased ? "Team Based" : "Solo"}
          </Badge>
        </div>
        <CardTitle>{data.title}</CardTitle>

        <div className="font-medium text-muted-foreground space-y-1.5 my-1.5">
          <div className="flex items-center gap-1">
            <MapPinIcon className="size-4" />
            <span className="text-xs">
              {data.venue?.title || "No location yet"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CalendarClockIcon className="size-4" />
            <span className="text-xs">{formatDateTime(data.startsAt)}</span>
          </div>
        </div>

        <CardDescription className="line-clamp-2 mb-0">
          {data.description}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-0">
        <Button asChild variant={"secondary"} className="group w-full">
          <Link href={`/events/${data.id}`}>
            View details{" "}
            <ArrowRightIcon className="group-hover:translate-x-1 transition" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EventCard;
