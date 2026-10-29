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
  DropdownMenuSeparator,
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

// Same page width and gutters as the student app.
const pageWidth = "mx-auto w-full max-w-380 px-5 md:px-10 lg:px-14";

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

function UserMenu({ eventWebUrl }: { eventWebUrl?: string }) {
  const { user } = useAuthContext();
  const { pending, signOut } = useSignOut();
  const pathname = usePathname();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 min-w-0 gap-2 px-3"
          aria-label="Open account menu"
          disabled={pending}
        >
          <UserAvatar
            name={user.name}
            imageId={user.displayImageId}
            className="size-6"
          />
          <span className="max-w-24 truncate text-xs sm:max-w-48">
            {user.name.split(" ")[0]}
          </span>
          <ChevronDownIcon aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="sm:hidden">
          <DropdownMenuItem
            asChild
            className={cn(pathname === "/" && "bg-muted text-foreground")}
          >
            <Link href="/">Contests</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className={cn(
              pathname.startsWith("/practice") && "bg-muted text-foreground",
            )}
          >
            <Link href="/practice">Practice</Link>
          </DropdownMenuItem>
          {eventWebUrl && (
            <DropdownMenuItem asChild>
              <a href={eventWebUrl}>
                Events
                <ArrowUpRightIcon aria-hidden />
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
        </div>
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
  if (pathname === "/sign-in") return <>{children}</>;
  return (
    <>
      <div className="border-b">
        <div className={pageWidth}>
        <header className="relative flex w-full items-center justify-between gap-4 py-5">
          <Link
            href="/"
            aria-label="PUB FestHub contests"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Image
              src="/logo.svg"
              alt="PUB FestHub"
              width={133}
              height={56}
              priority
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 sm:flex"
            >
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
            <UserMenu eventWebUrl={eventWebUrl} />
          </div>
        </header>
        </div>
      </div>
      <main className={cn(pageWidth, "flex-1 py-6 sm:py-10")}>
        {auth.status === "authenticated" ? (
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
