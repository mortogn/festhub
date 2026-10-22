"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@festhub/ui/components/input-group";
import React, { useState } from "react";
import { SearchIcon } from "@festhub/ui/icons";
import MaxWidthWrapper from "@/components/max-width-wrapper";
import { cn } from "@festhub/ui/lib/utils";
import Image from "next/image";

const TYPES = ["All", "Contest", "Workshop", "Seminar"];

const Banner: React.FC = () => {
  const [selectedType, setSelectedType] = useState("All");

  return (
    <section className="bg-sky-50/60 min-h-80 flex items-center mb-7 relative">
      <MaxWidthWrapper>
        <div className="space-y-5 max-w-190">
          <h1 className="text-5xl font-black tracking-tight">
            Expore Campus Events
          </h1>
          <p className="tracking-wide">
            Find hackathon, programming contest, typing contest and many more
            events you might be excited about
          </p>

          <div className="bg-white">
            <InputGroup className="h-11">
              <InputGroupAddon align={"inline-start"} className="mx-1.5">
                <SearchIcon className="size-5" />
              </InputGroupAddon>

              <InputGroupInput
                className="font-medium"
                placeholder="Search events, keywords, categories etc"
              />
            </InputGroup>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "text-xs bg-secondary text-secondary-foreground px-4 font-medium py-1 rounded-full border border-border",
                  {
                    "bg-primary text-primary-foreground": selectedType === type,
                  },
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </MaxWidthWrapper>

      <div className="absolute right-0 bottom-0 top-0 -z-10">
        <div className="relative h-full w-350">
          <Image
            src={"/pub_banner.png"}
            alt="pub"
            loading="eager"
            fill
            className="object-cover object-[center_34%] opacity-50"
          />
        </div>
      </div>
    </section>
  );
};

export default Banner;
