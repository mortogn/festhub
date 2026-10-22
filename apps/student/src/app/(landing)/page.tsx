import React, { Suspense } from "react";
import Events from "../_components/events";
import Banner from "../_components/banner";
import MaxWidthWrapper from "@/components/max-width-wrapper";

export default async function Home() {
  return (
    <div>
      <Banner />
      <MaxWidthWrapper>
        <Suspense fallback="loading...">
          <Events />
        </Suspense>
      </MaxWidthWrapper>
    </div>
  );
}
