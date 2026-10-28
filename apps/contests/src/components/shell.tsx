"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type PropsWithChildren } from "react";
import { useAuthContext, useSignOut } from "@festhub/frontend/auth";
import { Button } from "@festhub/ui/components/button";
import { Skeleton } from "@festhub/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@festhub/ui/components/dropdown-menu";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  LogOutIcon,
} from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import { LoadingBlock } from "./status";
import { UserAvatar } from "./user-avatar";

const navLink =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

// Inlined at build time; ignore values that are not absolute http(s) URLs so
// the link never resolves relative to this site.
function configuredEventUrl() {
  const value = process.env.NEXT_PUBLIC_EVENT_WEB_URL?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function UserMenu() {
  const { user } = useAuthContext();
  const { pending, signOut } = useSignOut();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className="group flex items-center gap-2.5 rounded-full border bg-card py-1 pr-2.5 pl-1 shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted"
        >
          <UserAvatar name={user.name} imageId={user.displayImageId} />
          <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
            {user.name}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => void signOut()}
        >
          <LogOutIcon aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ children }: PropsWithChildren) {
  const eventWebUrl = configuredEventUrl();
  const auth = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "unauthenticated" && pathname !== "/sign-in")
      router.replace("/sign-in");
  }, [auth.status, pathname, router]);
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link
            href="/"
            aria-label="PUB FestHub contests"
            className="flex items-center gap-3 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Image
              src="/logo.svg"
              alt="PUB FestHub"
              width={123}
              height={58}
              className="h-16 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav aria-label="Primary" className="flex items-center gap-1">
              <Link
                href="/"
                className={cn(
                  navLink,
                  pathname === "/" && "bg-muted text-foreground",
                )}
              >
                Contests
              </Link>
              <Link
                href="/practice"
                className={cn(
                  navLink,
                  pathname.startsWith("/practice") &&
                    "bg-muted text-foreground",
                )}
              >
                Practice
              </Link>
              {eventWebUrl && (
                <a href={eventWebUrl} className={navLink}>
                  Events
                  <ArrowUpRightIcon className="size-3.5" />
                </a>
              )}
            </nav>
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        {pathname === "/sign-in" ? (
          children
        ) : auth.status === "authenticated" ? (
          <div className="rise-in">{children}</div>
        ) : auth.status === "error" ? (
          <ErrorState
            message={auth.error ?? "Unable to load your account"}
            retry={auth.retry}
          />
        ) : (
          <LoadingBlock label="Loading your account…">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-80 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </LoadingBlock>
        )}
      </main>
      <footer className="border-t px-5 py-6 text-center text-xs text-muted-foreground">
        PUB FestHub · Competitive programming
      </footer>
    </>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
    >
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1 space-y-3">
        <p className="text-sm text-destructive">{message}</p>
        {retry && (
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
