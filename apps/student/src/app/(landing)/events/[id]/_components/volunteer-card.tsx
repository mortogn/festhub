import client from "@/lib/api";
import { formatDateTime } from "@/utils/format-date-time";
import { CalendarClockIcon, HandHeartIcon } from "@festhub/ui/icons";
import { InferResponseType } from "hono";
import React from "react";
import VolunteerRegisterButton from "./volunteer-register-button";

type Props = {
  event: InferResponseType<(typeof client)["events"][":id"]["$get"], 200>;
};

const VolunteerCard: React.FC<Props> = ({ event }) => {
  return (
    <div className=" border border-border py-6 px-6 space-y-6 rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-secondary text-secondary-foreground p-4 rounded-md h-min w-min">
          <HandHeartIcon className="size-6" />
        </div>
        <div>
          <h3 className="text-base font-medium">Become a Volunteer</h3>
          <p className="text-sm text-muted-foreground">
            Help make this event possible
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-muted-foreground text-xs">Volunteer Period</h4>

        <div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <CalendarClockIcon className="size-5" />
            <h4 className="text-sm">Starts</h4>
          </div>
          <p className="text-lg font-semibold text-center">
            {event.volunteerStartsAt
              ? formatDateTime(event.volunteerStartsAt)
              : "Will be announced"}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <CalendarClockIcon className="size-5" />
            <h4 className="text-sm">Ends</h4>
          </div>
          <p className="text-lg font-semibold text-center">
            {event.volunteerEndsAt
              ? formatDateTime(event.volunteerEndsAt)
              : "Will be announced"}
          </p>
        </div>
      </div>
      <VolunteerRegisterButton
        eventId={event.id}
        open={event.volunteerRegistration === "open"}
        endsAt={event.endsAt}
      />
    </div>
  );
};

export default VolunteerCard;
