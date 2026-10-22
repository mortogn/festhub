"use client";

import { Button } from "@festhub/ui/components/button";
import React from "react";
import MaxWidthWrapper from "./max-width-wrapper";
import Link from "next/link";
import { useAuthContext } from "@/context/auth-user-context";
import Image from "next/image";

const Header: React.FC = () => {
  const { user: currentUser } = useAuthContext();

  return (
    <MaxWidthWrapper>
      <header className="py-5 w-full flex items-center justify-between relative">
        <Image alt="festhub" src={"/logo.svg"} height={56} width={133} />

        {currentUser ? (
          <Link
            href="/profile"
            className="flex items-center gap-2 border border-border py-1.5 px-3 rounded-md shadow-sm hover:bg-muted"
          >
            <div className="size-8 rounded-full bg-secondary border border-border"></div>
            <p className="font-medium text-sm">{currentUser.name}</p>
          </Link>
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
