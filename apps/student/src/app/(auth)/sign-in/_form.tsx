"use client";

import React from "react";
import { useAuthContext } from "@/context/auth-user-context";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@festhub/shared/validation";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@festhub/ui/components/field";
import { Button } from "@festhub/ui/components/button";
import { z } from "zod";
import client from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@festhub/ui/components/input-group";
import { KeyIcon, MailIcon } from "@festhub/ui/icons";

type FormValues = z.infer<typeof signInSchema>;

const SignInForm: React.FC<{ returnTo?: string }> = ({ returnTo = "/" }) => {
  const { retry: refreshUser } = useAuthContext();
  const form = useForm<FormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const router = useRouter();

  const submitHandler = async (values: FormValues) => {
    form.clearErrors("root");

    try {
      const response = await client.auth["sign-in"].$post({
        json: {
          email: values.email,
          password: values.password,
        },
      });

      if (!response.ok) {
        form.setError("root", {
          message:
            response.status === 401
              ? "Incorrect email or password. Please try again."
              : "Unable to sign in right now. Please try again.",
        });
        return;
      }

      refreshUser();
      router.push(returnTo);
    } catch {
      form.setError("root", {
        message: "Could not connect. Check your connection and try again.",
      });
    }
  };

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
            name="email"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="sign-in-email">Email address</FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <MailIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    id="sign-in-email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "sign-in-email-error" : undefined
                    }
                    placeholder="you@example.com"
                    className="h-full"
                  />
                </InputGroup>

                {fieldState.invalid && (
                  <FieldError
                    id="sign-in-email-error"
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon align="inline-start" className="pl-3">
                    <KeyIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    type="password"
                    id="sign-in-password"
                    autoComplete="current-password"
                    required
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.invalid ? "sign-in-password-error" : undefined
                    }
                    placeholder="Enter your password"
                    className="h-full"
                  />
                </InputGroup>

                {fieldState.invalid && (
                  <FieldError
                    id="sign-in-password-error"
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
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
};

export default SignInForm;
