"use client";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import { Skeleton } from "@festhub/ui/components/skeleton";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  InboxIcon,
  LockIcon,
  TimerIcon,
} from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import { loadContests, type Contest } from "@/lib/api";
import { usePoll, useClock } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock, PhaseBadge, contestPhase } from "./status";

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_~]+/g, " ")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ContestList() {
  const now = useClock();
  const { data, error, refresh } = usePoll(loadContests, 30000);
  const upcoming =
    data?.contests
      .filter((contest) => new Date(contest.endsAt).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ) ?? [];
  const previous =
    data?.contests
      .filter((contest) => new Date(contest.endsAt).getTime() <= now)
      .sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      ) ?? [];

  return (
    <div className="space-y-12">
      {error && <ErrorState message={error} retry={refresh} />}

      <section aria-labelledby="upcoming-contests" className="space-y-5">
        <div className="space-y-1">
          <h1
            id="upcoming-contests"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Upcoming contests
          </h1>
          <p className="text-sm text-muted-foreground">
            Ongoing now and starting soon.
          </p>
        </div>

        {!data && !error ? (
          <LoadingBlock label="Loading contests…">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-60 rounded-xl" />
              ))}
            </div>
          </LoadingBlock>
        ) : upcoming.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((contest) => (
              <UpcomingContestCard
                key={contest.id}
                contest={contest}
                now={now}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-dashed shadow-none ring-0">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="size-5" />
              </span>
              <p className="max-w-sm text-sm">
                No upcoming contests right now. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="previous-contests" className="space-y-5">
        <h2
          id="previous-contests"
          className="text-xl font-semibold tracking-tight sm:text-2xl"
        >
          Previous contests
        </h2>

        {!data && !error ? (
          <div className="space-y-2 rounded-2xl border bg-card p-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : previous.length ? (
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {previous.map((contest) => (
              <PreviousContestRow key={contest.id} contest={contest} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            No previous contests yet.
          </p>
        )}
      </section>
    </div>
  );
}

function UpcomingContestCard({
  contest,
  now,
}: {
  contest: Contest;
  now: number;
}) {
  const starts = new Date(contest.startsAt).getTime();
  const ends = new Date(contest.endsAt).getTime();
  const phase = contestPhase(starts, ends, now);
  const description = plainText(contest.description ?? "");
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-2 px-6 pt-6 pb-4">
        <CardAction>
          <PhaseBadge phase={phase} />
        </CardAction>
        <CardTitle className="text-xl leading-snug font-semibold tracking-tight text-balance">
          {contest.title}
        </CardTitle>
        {description && (
          <CardDescription className="line-clamp-2">
            {description}
          </CardDescription>
        )}
        {contest.hasPassword && (
          <Badge variant="outline" className="mt-1 w-fit gap-1">
            <LockIcon />
            Password required
          </Badge>
        )}
      </CardHeader>
      <CardContent className="mt-auto gap-3 px-6 pb-0">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <CalendarClockIcon className="size-4 shrink-0 text-brand" />
            {formatDateTime(starts)}
          </li>
          <li className="flex items-center gap-2.5">
            <TimerIcon className="size-4 shrink-0 text-brand" />
            {formatDuration(ends - starts)}
          </li>
        </ul>
      </CardContent>
      <CardFooter className="px-6 pt-5 pb-6">
        <Button
          variant={phase === "live" ? "default" : "outline"}
          asChild
          className="h-10 w-full"
        >
          <Link href={`/contests/${contest.slug}`}>
            Open contest
            <ArrowRightIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function PreviousContestRow({ contest }: { contest: Contest }) {
  const starts = new Date(contest.startsAt).getTime();
  const ends = new Date(contest.endsAt).getTime();
  return (
    <Link
      href={`/contests/${contest.slug}`}
      className={cn(
        "group flex flex-wrap items-center justify-between gap-3 px-5 py-4",
        "transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50",
        "focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-6",
      )}
    >
      <div className="min-w-0 space-y-1">
        <h3 className="truncate text-sm font-semibold sm:text-base">
          {contest.title}
        </h3>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClockIcon className="size-3.5 shrink-0 text-brand" />
            {formatDateTime(starts)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <TimerIcon className="size-3.5 shrink-0 text-brand" />
            {formatDuration(ends - starts)}
          </span>
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        View contest
        <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
