"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { signInSchema } from "@festhub/shared/validation";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@festhub/ui/components/card";
import {
  CodeIcon,
  KeyIcon,
  ListChecksIcon,
  MailIcon,
  TrophyIcon,
} from "@festhub/ui/icons";
import { client, readResponse } from "@/lib/api";
import { ErrorState } from "./shell";

const perks = [
  { icon: CodeIcon, text: "Solve problems in your favourite language" },
  { icon: ListChecksIcon, text: "Get instant verdicts from the judge" },
  { icon: TrophyIcon, text: "Climb the live standings" },
];

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
    <div className="mx-auto grid w-full max-w-5xl items-stretch overflow-hidden rounded-3xl border bg-card shadow-soft md:my-6 md:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground md:flex md:flex-col md:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full bg-brand/60 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div className="relative space-y-4">
          <p className="font-mono text-xs tracking-widest text-white/70 uppercase">
            PUB FestHub · Contests
          </p>
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            Code. Compete. Climb.
          </h2>
        </div>
        <ul className="relative space-y-4">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/85">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
      <Card className="rounded-none bg-transparent py-10 shadow-none ring-0 md:px-4">
        <CardHeader>
          <p className="mb-3 font-mono text-xs tracking-widest text-brand uppercase">
            Ready when you are
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Sign in to compete
          </CardTitle>
          <CardDescription>Use your existing FestHub account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <MailIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  disabled={pending}
                  className="h-10 pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={pending}
                  className="h-10 pl-9"
                />
              </div>
            </div>
            {error && <ErrorState message={error} />}
            <Button className="h-10 w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
