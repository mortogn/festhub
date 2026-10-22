"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentSignUpSchema } from "@festhub/shared/validation";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@festhub/ui/components/field";
import { Button } from "@festhub/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@festhub/ui/components/input-group";
import { KeyIcon, MailIcon } from "@festhub/ui/icons";
import { z } from "zod";
import { useRouter } from "next/navigation";
import client from "@/lib/api";

const formSchema = studentSignUpSchema.extend({
  department: z.string().trim().min(1, "Enter your department."),
  studentId: z.string().trim().min(1, "Enter your student ID."),
  batch: z.string().trim().min(1, "Enter your batch."),
});

type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const fields = [
  {
    name: "name",
    label: "Full name",
    placeholder: "Your full name",
    autoComplete: "name",
  },
  {
    name: "email",
    label: "Email address",
    placeholder: "you@example.com",
    type: "email",
    autoComplete: "username",
    autoCapitalize: "none",
    spellCheck: false,
  },
  {
    name: "password",
    label: "Password",
    placeholder: "Create a password (8–32 characters)",
    type: "password",
    autoComplete: "new-password",
  },
  {
    name: "department",
    label: "Department",
    placeholder: "e.g. Computer Science and Engineering",
    autoComplete: "off",
  },
  {
    name: "studentId",
    label: "Student ID",
    placeholder: "Your student ID",
    autoComplete: "off",
  },
  {
    name: "batch",
    label: "Batch",
    placeholder: "Your batch",
    autoComplete: "off",
  },
] as const;

export default function SignUpForm() {
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      department: "",
      studentId: "",
      batch: "",
      role: "student",
      is_hsc: true,
    },
  });
  const router = useRouter();

  const submitHandler = async (values: FormValues) => {
    form.clearErrors("root");

    try {
      const response = await client.auth["sign-up"].$post({
        json: { ...values, role: "student" },
      });

      if (!response.ok) {
        const error = z
          .object({ message: z.string() })
          .safeParse(await response.json().catch(() => null));

        form.setError("root", {
          message:
            error.success && response.status < 500
              ? error.data.message
              : "Unable to create your account right now. Please try again.",
        });
        return;
      }

      router.push("/");
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
        <FieldGroup className="grid gap-5 sm:grid-cols-2">
          {fields.map(({ name, label, ...inputProps }) => (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className={
                    name === "studentId" || name === "batch"
                      ? "gap-2"
                      : "gap-2 sm:col-span-2"
                  }
                >
                  <FieldLabel htmlFor={`sign-up-${name}`}>{label}</FieldLabel>
                  <InputGroup className="h-11">
                    {(name === "email" || name === "password") && (
                      <InputGroupAddon align="inline-start" className="pl-3">
                        {name === "email" ? (
                          <MailIcon aria-hidden="true" />
                        ) : (
                          <KeyIcon aria-hidden="true" />
                        )}
                      </InputGroupAddon>
                    )}
                    <InputGroupInput
                      {...field}
                      {...inputProps}
                      id={`sign-up-${name}`}
                      required
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.invalid ? `sign-up-${name}-error` : undefined
                      }
                      className="h-full px-3"
                    />
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError
                      id={`sign-up-${name}-error`}
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
          ))}

          <Controller
            control={form.control}
            name="is_hsc"
            render={({ field }) => (
              <Field
                orientation="horizontal"
                className="items-center gap-2 sm:col-span-2"
              >
                <input
                  ref={field.ref}
                  id="sign-up-is-hsc"
                  name={field.name}
                  type="checkbox"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  onBlur={field.onBlur}
                  className="size-4 shrink-0 accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                <FieldLabel
                  htmlFor="sign-up-is-hsc"
                  className="min-h-11 cursor-pointer items-center"
                >
                  I have an HSC background
                </FieldLabel>
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
        {form.formState.isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
