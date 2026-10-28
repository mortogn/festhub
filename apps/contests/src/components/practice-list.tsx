"use client";
import Link from "next/link";
import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
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
  CheckCircle2Icon,
  CodeIcon,
  InboxIcon,
  TimerIcon,
} from "@festhub/ui/icons";
import { loadPractice, type PracticeContest } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock } from "./status";

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
function formatDateTime(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function formatDuration(start: string | Date | null, end: string | Date | null) {
  if (!start || !end) return null;
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
function progressLabel(contest: PracticeContest) {
  const total = contest.problemCount ?? 0;
  if (!total) return "No problems yet";
  return `${contest.solvedCount ?? 0} / ${total} solved`;
}

export function PracticeList() {
  const { data, error, refresh } = usePoll(loadPractice, 30000);
  return (
    <div className="space-y-12">
      {error && <ErrorState message={error} retry={refresh} />}
      <section aria-labelledby="practice-sets" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1
              id="practice-sets"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Practice problem sets
            </h1>
            <p className="text-sm text-muted-foreground">
              Curated problems you can solve at your own pace.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <CheckCircle2Icon />
            Progress is saved automatically
          </Badge>
        </div>
        {!data && !error ? (
          <LoadingBlock label="Loading practice…">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-60 rounded-xl" />
              ))}
            </div>
          </LoadingBlock>
        ) : data?.problemSets.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.problemSets.map((contest) => (
              <PracticeCard key={contest.id} contest={contest} />
            ))}
          </div>
        ) : (
          <Card className="border border-dashed shadow-none ring-0">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <InboxIcon className="size-5" />
              </span>
              <p className="max-w-sm text-sm">
                No practice problem sets yet. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="past-contests" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="past-contests"
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            Practice contests
          </h2>
          <p className="text-sm text-muted-foreground">
            Finished contests are open for practice. Your submissions here do
            not affect the official standings.
          </p>
        </div>
        {!data && !error ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : data?.pastContests.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.pastContests.map((contest) => (
              <PracticeCard key={contest.id} contest={contest} past />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            No finished contests are available for practice yet.
          </p>
        )}
      </section>
    </div>
  );
}

function PracticeCard({
  contest,
  past = false,
}: {
  contest: PracticeContest;
  past?: boolean;
}) {
  const description = plainText(contest.description ?? "");
  const starts = formatDateTime(contest.startsAt);
  const ends = formatDateTime(contest.endsAt);
  const duration = formatDuration(contest.startsAt, contest.endsAt);
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-2 px-6 pt-6 pb-4">
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <CodeIcon />
            {past ? "Past contest" : "Problem set"}
          </Badge>
        </CardAction>
        <CardTitle className="text-xl leading-snug font-semibold tracking-tight text-balance">
          {contest.title}
        </CardTitle>
        {description && (
          <CardDescription className="line-clamp-2">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto gap-3 px-6 pb-0">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <CheckCircle2Icon className="size-4 shrink-0 text-brand" />
            {progressLabel(contest)}
          </li>
          {starts && ends && (
            <>
              <li className="flex items-center gap-2.5">
                <CalendarClockIcon className="size-4 shrink-0 text-brand" />
                {starts}
                {past && ` — ${ends}`}
              </li>
              {duration && (
                <li className="flex items-center gap-2.5">
                  <TimerIcon className="size-4 shrink-0 text-brand" />
                  {duration}
                </li>
              )}
            </>
          )}
        </ul>
      </CardContent>
      <CardFooter className="px-6 pt-5 pb-6">
        <Button variant="outline" asChild className="h-10 w-full">
          <Link href={`/practice/${contest.slug}`}>
            {(contest.solvedCount ?? 0) === (contest.problemCount ?? 0) &&
            (contest.problemCount ?? 0) > 0
              ? "Review problems"
              : "Start practice"}
            <ArrowRightIcon />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
