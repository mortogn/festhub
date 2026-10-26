"use client";

import Link from "next/link";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { Input } from "@festhub/ui/components/input";
import { UploadedAvatar } from "./uploaded-image";
import { SearchIcon } from "@festhub/ui/icons";
import { Textarea } from "@festhub/ui/components/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@festhub/ui/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import { Switch } from "@festhub/ui/components/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@festhub/ui/components/alert-dialog";
import { errorMessage } from "./api";
import type { Resource } from "./resource";
import { toast } from "@festhub/ui/components/sonner";
import { useToastFeedback } from "./notifications";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Section({
  title,
  description,
  action,
  children,
  plain = false,
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <section
      className={
        plain
          ? "min-w-0 space-y-4"
          : "min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      }
    >
      <div
        className={
          plain
            ? "flex flex-wrap items-start justify-between gap-3"
            : "flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5"
        }
      >
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className={plain ? "min-w-0" : "min-w-0 p-4 sm:p-5"}>{children}</div>
    </section>
  );
}
export function SearchInput({
  className = "",
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
      />
      <Input type="search" {...props} className="h-11 bg-background pl-9" />
    </div>
  );
}

export function PersonAvatar({
  name,
  imageId,
}: {
  name: string;
  imageId?: string | null;
}) {
  return <UploadedAvatar name={name} imageId={imageId} />;
}
export function ResourceContent({
  resource,
  children,
}: {
  resource: Pick<Resource<unknown>, "isLoading" | "error" | "retry">;
  children: ReactNode;
}) {
  const toastFeedback = useToastFeedback();
  if (resource.isLoading)
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading information</span>
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-16 w-full" />
        ))}
      </div>
    );
  if (resource.error)
    return (
      <div className="space-y-3 rounded-md border p-4">
        <p role="alert" className="text-sm text-muted-foreground">
          {toastFeedback
            ? "This information could not be loaded."
            : resource.error}
        </p>
        <Button variant="outline" size="sm" onClick={resource.retry}>
          Try again
        </Button>
      </div>
    );
  return children;
}
export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {href && action && (
        <Button asChild variant="outline" className="mt-4">
          <Link href={href}>{action}</Link>
        </Button>
      )}
    </div>
  );
}
export function StatusBadge({ status }: { status: string | null }) {
  const classes =
    status === "accepted" ||
    status === "approved" ||
    status === "active" ||
    status === "published" ||
    status === "available"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "pending"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : status === "rejected"
          ? "bg-destructive/10 text-destructive"
          : "";
  return (
    <Badge variant="secondary" className={classes}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </Badge>
  );
}
type MutationProps = {
  children: ReactNode;
  action: () => Promise<unknown>;
  onSuccess?: () => void;
  confirm?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  className?: string;
  successMessage?: string;
};
export function MutationButton({
  children,
  action,
  onSuccess,
  confirm,
  variant = "outline",
  disabled,
  className,
  successMessage = "Updated successfully.",
}: MutationProps) {
  const toastFeedback = useToastFeedback();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  async function run() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      await action();
      if (toastFeedback) toast.success(successMessage);
      else setSuccess(true);
      onSuccess?.();
    } catch (error) {
      if (toastFeedback) toast.error(errorMessage(error));
      else setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  const button = (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={confirm ? undefined : run}
    >
      {pending ? "Please wait…" : children}
    </Button>
  );
  return (
    <div className="space-y-2">
      {confirm ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>{button}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm your action</AlertDialogTitle>
              <AlertDialogDescription>{confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={run}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        button
      )}
      {error && (
        <p role="alert" className="max-w-lg text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-xs text-muted-foreground">
          {successMessage}
        </p>
      )}
    </div>
  );
}

export type FieldSpec = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "datetime-local"
    | "textarea"
    | "select"
    | "switch";
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  description?: string;
  disabled?: boolean;
  fullWidth?: boolean;
};
export function Editor({
  title,
  fields,
  initialValues = {},
  onSubmit,
  submitLabel = "Save changes",
  successMessage = "Saved successfully.",
  persistentErrors = false,
}: {
  title?: string;
  fields: FieldSpec[];
  initialValues?: Record<string, string>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  submitLabel?: string;
  successMessage?: string;
  persistentErrors?: boolean;
}) {
  const toastFeedback = useToastFeedback();
  const prefix = useId();
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const update = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSuccess(false);
  };
  return (
    <form
      className="@container space-y-5"
      data-feedback={toastFeedback ? "toast" : "inline"}
      aria-busy={pending}
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setError(null);
        setSuccess(false);
        setPending(true);
        try {
          for (const field of fields) {
            const value = values[field.name] ?? "";
            if (field.required && field.type !== "switch" && !value.trim())
              throw new Error(`${field.label} is required.`);
            if (field.type === "number" && value !== "") {
              const number = Number(value);
              if (
                !Number.isInteger(number) ||
                number < (field.min ?? 1) ||
                (field.max !== undefined && number > field.max)
              )
                throw new Error(
                  `Enter a valid whole number for ${field.label.toLowerCase()}.`,
                );
            }
          }
          await onSubmit(values);
          if (toastFeedback) toast.success(successMessage);
          else setSuccess(true);
        } catch (error) {
          if (toastFeedback && !persistentErrors) toast.error(errorMessage(error));
          else setError(errorMessage(error));
        } finally {
          setPending(false);
        }
      }}
    >
      {title && <h3 className="text-base font-semibold">{title}</h3>}
      <FieldSet disabled={pending}>
        <FieldGroup className="grid min-w-0 gap-5 @min-[28rem]:grid-cols-2">
          {fields.map((field) => {
            const id = `${prefix}-${field.name}`;
            const value = values[field.name] ?? "";
            const descriptionId = field.description
              ? `${id}-description`
              : undefined;
            return (
              <Field
                key={field.name}
                className={
                  field.type === "textarea" ||
                  field.fullWidth ||
                  fields.length === 1
                    ? "min-w-0 gap-2 @min-[28rem]:col-span-2"
                    : "min-w-0 gap-2"
                }
              >
                <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
                {field.type === "select" ? (
                  <Select
                    name={field.name}
                    value={value}
                    disabled={field.disabled || pending}
                    required={field.required}
                    onValueChange={(v) => update(field.name, v)}
                  >
                    <SelectTrigger
                      id={id}
                      aria-describedby={descriptionId}
                      className="w-full data-[size=default]:h-11"
                    >
                      <SelectValue
                        placeholder={`Select ${field.label.toLowerCase()}`}
                      />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "switch" ? (
                  <Switch
                    id={id}
                    name={field.name}
                    checked={value === "true"}
                    disabled={field.disabled || pending}
                    aria-describedby={descriptionId}
                    onCheckedChange={(v) => update(field.name, String(v))}
                  />
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={id}
                    name={field.name}
                    value={value}
                    required={field.required}
                    disabled={field.disabled}
                    aria-describedby={descriptionId}
                    onChange={(e) => update(field.name, e.target.value)}
                    className="min-h-28"
                  />
                ) : (
                  <Input
                    id={id}
                    name={field.name}
                    type={field.type ?? "text"}
                    value={value}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.type === "number" ? 1 : undefined}
                    disabled={field.disabled}
                    aria-describedby={descriptionId}
                    onChange={(e) => update(field.name, e.target.value)}
                    className="h-11"
                  />
                )}
                {field.description && (
                  <FieldDescription id={descriptionId}>
                    {field.description}
                  </FieldDescription>
                )}
              </Field>
            );
          })}
        </FieldGroup>
      </FieldSet>
      {fields.some((f) => f.type === "datetime-local") && (
        <p className="text-xs text-muted-foreground">
          Bangladesh time (UTC+06:00)
        </p>
      )}
      {error && (
        <FieldError role="alert" className="min-w-0 whitespace-pre-line break-words">
          {error}
        </FieldError>
      )}
      {success && (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full sm:w-auto"
      >
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
