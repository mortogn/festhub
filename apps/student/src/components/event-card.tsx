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
  MapPinIcon,
} from "@festhub/ui/icons";
import { InferResponseType } from "hono";
import Link from "next/link";
import React from "react";

type EventsResponse = InferResponseType<(typeof client)["events"]["$get"], 200>;

type EventCardProps = {
  data: EventsResponse[number];
};

const EventCard: React.FC<EventCardProps> = ({ data }) => {
  return (
    <Card className="mt-0 pt-0 space-y-1 gap-2.5 px-0">
      <div className="aspect-video bg-slate-400"></div>

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
