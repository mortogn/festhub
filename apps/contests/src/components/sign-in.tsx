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
    <Card className="mx-auto my-8 w-full max-w-md">
      <CardHeader>
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Ready when you are
        </p>
        <CardTitle className="text-2xl">Sign in to compete</CardTitle>
        <CardDescription>Use your existing FestHub account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
