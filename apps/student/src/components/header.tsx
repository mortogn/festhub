"use client";

import { Button } from "@festhub/ui/components/button";
import React, { useState } from "react";
import MaxWidthWrapper from "./max-width-wrapper";
import Link from "next/link";
import { useAuthContext } from "@/context/auth-user-context";
import Image from "next/image";
import InvitationNotifications from "./invitation-notifications";
import { UploadedAvatar } from "@festhub/frontend/uploaded-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@festhub/ui/components/dropdown-menu";
import { ChevronDownIcon, LogOutIcon, QrCodeIcon } from "@festhub/ui/icons";
import { useRouter } from "next/navigation";
import { profileNavigation } from "./profile-navigation";
import MyQrDialog from "./my-qr-dialog";

const Header: React.FC = () => {
  const { user: currentUser, signOut } = useAuthContext();
  const [qrOpen, setQrOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function logout() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <MaxWidthWrapper>
      <header className="py-5 w-full flex items-center justify-between relative">
        <Link href={"/"}>
          <Image alt="festhub" src={"/logo.svg"} height={56} width={133} />
        </Link>
        {currentUser ? (
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <InvitationNotifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 min-w-0 gap-2 px-3"
                  aria-label="Open account menu"
                  disabled={signingOut}
                >
                  <UploadedAvatar
                    imageId={currentUser.displayImageId}
                    name={currentUser.name}
                    className="size-6"
                  />
                  <span className="max-w-24 truncate text-xs sm:max-w-48">
                    {currentUser.name.split(" ")[0]}
                  </span>
                  <ChevronDownIcon aria-hidden="true" className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {currentUser.role === "student" && (
                  <>
                    <DropdownMenuItem onSelect={() => setQrOpen(true)}>
                      <QrCodeIcon aria-hidden="true" /> My QR
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {profileNavigation.map((item) => (
                  <DropdownMenuItem asChild key={item.href}>
                    <Link href={item.href}>
                      <item.icon aria-hidden="true" />{item.title}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={signingOut}
                  onSelect={() => { void logout(); }}
                >
                  <LogOutIcon aria-hidden="true" /> {signingOut ? "Logging out…" : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <MyQrDialog
              key={currentUser.id}
              userId={currentUser.id}
              open={qrOpen}
              onOpenChange={setQrOpen}
            />
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
      {error && (
        <p role="alert" className="mb-4 text-right text-sm text-destructive">{error}</p>
      )}
    </MaxWidthWrapper>
  );
};

export default Header;
