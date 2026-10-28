"use client";
import Link from "next/link";
import { Suspense, useCallback, useState, type FormEvent } from "react";
import MarkdownIt from "markdown-it";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { Skeleton } from "@festhub/ui/components/skeleton";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  ClockIcon,
  LockIcon,
  TimerIcon,
} from "@festhub/ui/icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import {
  client,
  readResponse,
  loadContest,
  loadProblems,
  loadSamples,
  type Contest,
} from "@/lib/api";
import { usePoll, useClock } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock, PhaseBadge, contestPhase } from "./status";
import { ProblemWorkspace } from "./problem-workspace";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
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

export function ContestWorkspace({ slug }: { slug: string }) {
  const loader = useCallback(() => loadContest(slug), [slug]);
  const { data: contest, error, refresh } = usePoll(loader, 15000);
  const auth = useAuthContext();
  const now = useClock();
  const contestId = contest?.id;
  const problemLoader = useCallback(
    () => loadProblems(contestId!),
    [contestId],
  );
  const sampleLoader = useCallback(
    (id: string, problemId: string) => loadSamples(id, problemId),
    [],
  );
  const submit = useCallback(
    async (
      id: string,
      problemId: string,
      sourceCode: string,
      languageCode: number,
    ) =>
      readResponse(
        await client.contests[":contestId"].problems[
          ":problemId"
        ].submission.$post({
          param: { contestId: id, problemId },
          json: { sourceCode, languageCode },
        }),
      ),
    [],
  );
  if (!contest)
    return error ? (
      <ErrorState message={error} retry={refresh} />
    ) : (
      <LoadingBlock label="Loading contest…">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </LoadingBlock>
    );
  const starts = contest.startsAt ? new Date(contest.startsAt).getTime() : 0;
  const ends = contest.endsAt
    ? new Date(contest.endsAt).getTime()
    : starts;
  const phase = contestPhase(starts, ends, now);
  const staff = auth.user?.role === "teacher" || auth.user?.role === "admin";
  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All contests
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex-1 basis-80 space-y-3">
          <PhaseBadge phase={phase} />
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {contest.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarClockIcon className="size-4 shrink-0 text-brand" />
              {formatDateTime(starts)} — {formatDateTime(ends)}
            </span>
            <span className="inline-flex items-center gap-2">
              <TimerIcon className="size-4 shrink-0 text-brand" />
              {formatDuration(ends - starts)}
            </span>
          </div>
        </div>
        <div className="flex min-w-52 flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <TimerIcon className="size-3.5" />
            {phase === "upcoming"
              ? "Starts in"
              : phase === "finished"
                ? "Contest finished"
                : "Time remaining"}
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {duration((now < starts ? starts : ends) - now)}
          </p>
        </div>
      </div>
      {contest.description && (
        <div
          className="statement max-w-3xl text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{
            __html: markdown.render(contest.description),
          }}
        />
      )}
      {error && <ErrorState message={error} retry={refresh} />}
      {contest.isLocked ? (
        <Unlock contest={contest} onUnlocked={refresh} />
      ) : now < starts && !staff ? (
        <Card className="border-dashed shadow-none ring-0 border">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ClockIcon className="size-5" />
            </span>
            Problems will be available when the contest starts.
          </CardContent>
        </Card>
      ) : (
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <ProblemWorkspace
            contestId={contest.id}
            contestTitle={contest.title}
            contestHref={`/contests/${contest.slug}`}
            allowedLanguages={contest.allowedLanguages}
            canSubmit={
              auth.user?.role === "student" &&
              now >= starts &&
              now < ends &&
              contest.isActive
            }
            showStandings
            loadProblems={problemLoader}
            loadSamples={sampleLoader}
            submit={submit}
          />
        </Suspense>
      )}
    </div>
  );
}

function Unlock({
  contest,
  onUnlocked,
}: {
  contest: Contest;
  onUnlocked: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError(null);
    try {
      await readResponse(
        await client.contests[":contestId"].unlock.$post({
          param: { contestId: contest.id },
          json: { password },
        }),
      );
      onUnlocked();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <Card className="max-w-md">
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <LockIcon className="size-5" />
        </span>
        <CardTitle className="text-lg font-semibold">
          Enter contest password
        </CardTitle>
        <CardDescription>
          This contest is protected. Ask your organizer for the password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contest-password">Contest password</Label>
            <Input
              id="contest-password"
              name="password"
              type="password"
              autoComplete="off"
              required
              maxLength={72}
              disabled={pending}
              className="h-10"
            />
          </div>
          {error && <ErrorState message={error} />}
          <Button disabled={pending}>
            {pending ? "Checking…" : "Unlock contest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
