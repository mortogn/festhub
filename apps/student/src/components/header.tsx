"use client";

import { Button } from "@festhub/ui/components/button";
import React from "react";
import MaxWidthWrapper from "./max-width-wrapper";
import Link from "next/link";
import { useAuthContext } from "@/context/auth-user-context";
import Image from "next/image";
import InvitationNotifications from "./invitation-notifications";

const Header: React.FC = () => {
  const { user: currentUser } = useAuthContext();

  return (
    <MaxWidthWrapper>
      <header className="py-5 w-full flex items-center justify-between relative">
        <Image alt="festhub" src={"/logo.svg"} height={56} width={133} />

        {currentUser ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <InvitationNotifications />
            <Link
              href="/profile"
              className="flex min-w-0 items-center gap-2 border border-border py-1.5 h-10 px-3 rounded-md shadow-sm hover:bg-muted"
            >
              <div className="size-6 shrink-0 rounded-full bg-secondary border border-border"></div>
              <p className="max-w-24 truncate font-medium text-xs sm:max-w-48">
                {currentUser.name.split(" ")[0]}
              </p>
            </Link>
          </div>
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
