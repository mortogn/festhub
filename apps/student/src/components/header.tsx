"use client";

import { Button } from "@festhub/ui/components/button";
import React from "react";
import MaxWidthWrapper from "./max-width-wrapper";
import Link from "next/link";
import { useAuthContext } from "@/context/auth-user-context";

const Header: React.FC = () => {
  const currentUser = useAuthContext();

  return (
    <MaxWidthWrapper>
      <header className="py-5 w-full flex items-center justify-between relative">
        <img alt="" src={"/logo.svg"} className="h-14 " />

        {currentUser ? (
          <div>{currentUser.email}</div>
        ) : (
          <div className="space-x-2">
            <Button asChild className="px-5" size={"lg"} variant={"secondary"}>
              <Link href={"/sign-in"}>Sign in</Link>
            </Button>
            <Button asChild className="px-5" size={"lg"}>
              <Link href={"/sign-up"}>Sign up</Link>
            </Button>
          </div>
        )}
      </header>
    </MaxWidthWrapper>
  );
};

export default Header;
