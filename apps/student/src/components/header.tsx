import { Button } from "@festhub/ui/components/button";
import Image from "next/image";
import React from "react";
import MaxWidthWrapper from "./max-width-wrapper";

const Header: React.FC = () => {
  return (
    <MaxWidthWrapper>
      <header className="py-5 w-full flex items-center justify-between relative">
        <img alt="" src={"/logo.svg"} className="h-14 " />

        <div className="space-x-2">
          <Button className="px-5" size={"lg"} variant={"secondary"}>
            Sign in
          </Button>
          <Button className="px-5" size={"lg"}>
            Sign Up
          </Button>
        </div>
      </header>
    </MaxWidthWrapper>
  );
};

export default Header;
