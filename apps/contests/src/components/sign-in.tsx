"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { signInSchema } from "@festhub/shared/validation";
import { Button } from "@festhub/ui/components/button";
import { Label } from "@festhub/ui/components/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@festhub/ui/components/input-group";
import { KeyIcon, MailIcon } from "@festhub/ui/icons";
import { client, readResponse } from "@/lib/api";
import { ErrorState } from "./shell";

export function SignIn() {
  const auth = useAuthContext();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/");
  }, [auth.status, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = signInSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!input.success) {
      setError(input.error.issues.map((issue) => issue.message).join(". "));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await readResponse(
        await client.auth["sign-in"].$post({ json: input.data }),
      );
      await auth.refreshUser();
      router.replace("/");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="sticky top-0 hidden h-dvh overflow-hidden lg:block">
        <Image
          src="/pub_campus.png"
          alt="University campus"
          fill
          priority
          sizes="50vw"
          className="object-cover saturate-75"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
          <p className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
            Code. Compete.
            <br />
            Climb the standings.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            Solve problems in your favourite language and get instant verdicts
            from the judge.
          </p>
        </div>
      </aside>
      <main className="flex min-h-dvh min-w-0 flex-col items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-12">
        <Link
          href="/"
          aria-label="FestHub contests home"
          className="mb-10 inline-flex rounded-lg bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <Image src="/logo.svg" alt="PUB FestHub" width={150} height={58} />
        </Link>
        <div className="w-full max-w-sm">
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in with your FestHub account to join contests.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <InputGroup className="h-11">
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <MailIcon aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={pending}
                    placeholder="you@example.com"
                    className="h-full"
                  />
                </InputGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <InputGroup className="h-11">
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <KeyIcon aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={pending}
                    placeholder="Enter your password"
                    className="h-full"
                  />
                </InputGroup>
              </div>
            </div>
            {error && <ErrorState message={error} />}
            <Button className="h-11 w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
