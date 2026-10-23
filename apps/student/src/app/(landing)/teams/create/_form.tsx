"use client";

import client from "@/lib/api";
import { createTeamSchema } from "@festhub/shared/validation";
import { Button } from "@festhub/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@festhub/ui/components/field";
import { Input } from "@festhub/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthContext } from "@/context/auth-user-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

type FormValues = z.infer<typeof createTeamSchema>;

type Props = {
  events: { id: string; title: string }[];
  initialEventId?: string;
};

export default function CreateTeamForm({ events, initialEventId }: Props) {
  const router = useRouter();
  const { user, status, retry } = useAuthContext();
  const form = useForm<FormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", eventId: initialEventId ?? "" },
  });

  async function submitHandler(values: FormValues) {
    form.clearErrors("root");

    try {
      const response = await client.teams.$post({ json: values });

      if (!response.ok) {
        if (response.status === 401) {
          form.setError("root", {
            message: "Please sign in to create a team.",
          });
          return;
        }

        const data = await response.json();
        form.setError("root", {
          message:
            "message" in data && typeof data.message === "string"
              ? data.message
              : "Unable to create your team right now. Please try again.",
        });
        return;
      }

      const team = await response.json();
      router.push(`/profile/teams/${team.id}`);
    } catch {
      form.setError("root", {
        message: "Could not connect. Check your connection and try again.",
      });
    }
  }

  if (status === "loading")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading your account…
      </p>
    );
  if (status === "error")
    return (
      <Button variant="outline" onClick={retry}>
        Retry loading your account
      </Button>
    );
  if (status === "unauthenticated")
    return (
      <Button asChild className="w-full">
        <Link href="/sign-in">Sign in to create a team</Link>
      </Button>
    );
  if (user?.role !== "student")
    return (
      <p className="text-sm text-muted-foreground">
        Teams are available to student accounts.
      </p>
    );

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submitHandler)}
      aria-busy={form.formState.isSubmitting}
      className="space-y-6"
    >
      <FieldSet disabled={form.formState.isSubmitting}>
        <FieldGroup className="gap-5">
          <Controller
            control={form.control}
            name="eventId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="team-event">Event</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={form.formState.isSubmitting}
                  required
                >
                  <SelectTrigger
                    ref={field.ref}
                    onBlur={field.onBlur}
                    id="team-event"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "team-event-error" : undefined
                    }
                    className="w-full min-w-0 px-3 data-[size=default]:h-11"
                  >
                    <SelectValue placeholder="Select a team event" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError id="team-event-error">
                    Please select an event.
                  </FieldError>
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="team-name">Team name</FieldLabel>
                <Input
                  {...field}
                  id="team-name"
                  required
                  maxLength={30}
                  autoComplete="off"
                  placeholder="e.g. Code Explorers"
                  className="h-11 px-3"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "team-name-description team-name-error"
                      : "team-name-description"
                  }
                />
                <FieldDescription id="team-name-description">
                  Use 1–30 characters. Your name must be unique for this event.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="team-name-error"
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      {form.formState.errors.root && (
        <FieldError className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5">
          {form.formState.errors.root.message}
        </FieldError>
      )}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="h-11 w-full"
      >
        {form.formState.isSubmitting ? "Creating team…" : "Create team"}
      </Button>
    </form>
  );
}
