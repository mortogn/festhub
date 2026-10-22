import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
import { Skeleton } from "@festhub/ui/components/skeleton";
import Link from "next/link";
import { ReactNode } from "react";
import { formatDateTime } from "@/utils/format-date-time";
import type { Resource } from "./profile-data";

export function ProfileSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function ResourceContent({
  resource,
  children,
}: {
  resource: Pick<Resource<unknown>, "isLoading" | "error" | "retry">;
  children: ReactNode;
}) {
  if (resource.isLoading) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading information</span>
        {[0, 1, 2].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (resource.error) {
    return (
      <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <p role="alert" className="text-sm text-destructive">{resource.error}</p>
        <Button variant="outline" size="sm" onClick={resource.retry}>
          Try again
        </Button>
      </div>
    );
  }
  return children;
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {href && action && (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={href}>{action}</Link>
        </Button>
      )}
    </div>
  );
}

const statuses: Record<string, { label: string; className: string }> = {
  accepted: { label: "Accepted", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
};

export function StatusBadge({ status }: { status: string | null }) {
  const style = status ? statuses[status] : undefined;
  return (
    <Badge variant="secondary" className={style?.className}>
      {style?.label ?? "Unknown"}
    </Badge>
  );
}

export function EventDates({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <time dateTime={startsAt}>{formatDateTime(startsAt)}</time>
      {" – "}
      <time dateTime={endsAt}>{formatDateTime(endsAt)}</time>
    </p>
  );
}
