"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInSchema, signUpSchema } from "@festhub/shared/validation";
import { Button } from "@festhub/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@festhub/ui/components/field";
import { Input } from "@festhub/ui/components/input";
import client, { errorMessage, readResponse } from "./api";
import { SignOutButton, useAuthContext } from "./auth";
import { toast } from "@festhub/ui/components/sonner";
import { useToastFeedback } from "./notifications";

export function StaffAuth({
  role,
  signup = false,
}: {
  role: "teacher" | "admin";
  signup?: boolean;
}) {
  const toastFeedback = useToastFeedback();
  const router = useRouter();
  const auth = useAuthContext();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const isSignup = signup && role === "teacher";

  useEffect(() => {
    if (auth.status === "authenticated" && auth.user?.role === role)
      router.replace("/dashboard");
  }, [auth.status, auth.user, role, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setErrors({});
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (isSignup) {
      values.name = String(values.name ?? "").trim();
      values.department = String(values.department ?? "").trim();
      values.teacherId = String(values.teacherId ?? "").trim();
    }
    const result = isSignup
      ? signUpSchema.safeParse({ ...values, role: "teacher" })
      : signInSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues)
        nextErrors[String(issue.path[0])] ??= issue.message;
      setErrors(nextErrors);
      return;
    }
    if (
      isSignup &&
      (!String(values.department).trim() || !String(values.teacherId).trim())
    ) {
      setErrors({
        ...(!String(values.department).trim()
          ? { department: "Enter your department." }
          : {}),
        ...(!String(values.teacherId).trim()
          ? { teacherId: "Enter your teacher ID." }
          : {}),
      });
      return;
    }
    setPending(true);
    try {
      if (isSignup) {
        const signupValues = signUpSchema.parse({ ...values, role: "teacher" });
        await readResponse(
          await client.auth["sign-up"].$post({ json: signupValues }),
        );
      } else {
        await readResponse(
          await client.auth["sign-in"].$post({
            json: { email: result.data.email, password: result.data.password },
          }),
        );
      }
      const user = await readResponse(await client.users.self.$get());
      auth.retry();
      if (user.role !== role) {
        const message = `This account does not have ${role} access. Sign out to use another account.`;
        if (toastFeedback) toast.error(message);
        else setError(message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      if (toastFeedback) toast.error(errorMessage(cause));
      else setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  const denied = auth.status === "authenticated" && auth.user?.role !== role;
  if (denied)
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-md border border-border p-8 shadow-sm">
          <h1 className="text-2xl font-bold">Use your {role} account</h1>
          <p className="text-sm text-muted-foreground">
            The account currently signed in does not have access to this
            dashboard. Sign out to use another account.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  const fields = [
    ...(isSignup
      ? [
          {
            name: "name",
            label: "Full name",
            type: "text",
            autocomplete: "name",
            placeholder: "Your full name",
          },
        ]
      : []),
    {
      name: "email",
      label: "Email address",
      type: "email",
      autocomplete: "username",
      placeholder: "you@example.com",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      autocomplete: isSignup ? "new-password" : "current-password",
      placeholder: isSignup
        ? "Choose a password (8–32 characters)"
        : "Enter your password",
    },
    ...(isSignup
      ? [
          {
            name: "department",
            label: "Department",
            type: "text",
            autocomplete: "organization",
            placeholder: "Your department",
          },
          {
            name: "teacherId",
            label: "Teacher ID",
            type: "text",
            autocomplete: "off",
            placeholder: "Your institutional teacher ID",
          },
        ]
      : []),
  ];
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-md border border-border p-6 shadow-sm sm:p-8">
        <Link
          href="/"
          aria-label="FestHub home"
          className="mx-auto mb-8 block w-fit"
        >
          <Image src="/logo.svg" alt="PUB FestHub" width={123} height={58} />
        </Link>
        <div className="mb-8 space-y-2">
          <p className="text-xs font-medium capitalize text-muted-foreground">
            {role} portal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isSignup
              ? "Use the email address invited by your administrator to join FestHub."
              : "Sign in to manage university events."}
          </p>
        </div>
        <form
          noValidate
          onSubmit={submit}
          aria-busy={pending}
          className="space-y-6"
        >
          <FieldSet disabled={pending}>
            <FieldGroup className="gap-5">
              {fields.map((field) => (
                <Field
                  key={field.name}
                  data-invalid={Boolean(errors[field.name])}
                  className="gap-2"
                >
                  <FieldLabel htmlFor={`staff-${field.name}`}>
                    {field.label}
                  </FieldLabel>
                  <Input
                    id={`staff-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autocomplete}
                    placeholder={field.placeholder}
                    required
                    className="h-11"
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={
                      errors[field.name]
                        ? `staff-${field.name}-error`
                        : undefined
                    }
                    minLength={field.name === "password" ? 8 : undefined}
                    maxLength={field.name === "password" ? 32 : undefined}
                  />
                  {errors[field.name] && (
                    <FieldError id={`staff-${field.name}-error`}>
                      {errors[field.name]}
                    </FieldError>
                  )}
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>
          {error && (
            <FieldError
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5"
            >
              {error}
            </FieldError>
          )}
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
        {role === "teacher" && (
          <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Invited to FestHub?"}{" "}
            <Button variant="link" asChild>
              <Link href={isSignup ? "/sign-in" : "/sign-up"}>
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </Button>
          </p>
        )}
      </div>
    </main>
  );
}
