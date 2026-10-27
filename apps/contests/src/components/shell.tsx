"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type PropsWithChildren } from "react";
import { SignOutButton, useAuthContext } from "@festhub/frontend/auth";
import { Button } from "@festhub/ui/components/button";

export function Shell({ children }: PropsWithChildren) {
  const auth = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "unauthenticated" && pathname !== "/sign-in")
      router.replace("/sign-in");
  }, [auth.status, pathname, router]);
  return (
    <>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold tracking-tight"
          >
            <span className="rounded-md bg-primary px-2 py-1 font-mono text-primary-foreground">
              &lt;/&gt;
            </span>
            FestHub{" "}
            <span className="hidden font-normal text-muted-foreground sm:inline">
              Contests
            </span>
          </Link>
          {auth.user && (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:block">
                {auth.user.name}
              </span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        {pathname === "/sign-in" ? (
          children
        ) : auth.status === "authenticated" ? (
          children
        ) : auth.status === "error" ? (
          <ErrorState
            message={auth.error ?? "Unable to load your account"}
            retry={auth.retry}
          />
        ) : (
          <p role="status" className="text-muted-foreground">
            Loading your account…
          </p>
        )}
      </main>
      <footer className="border-t px-5 py-5 text-center text-xs text-muted-foreground">
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
      className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
    >
      <p className="text-sm text-destructive">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
