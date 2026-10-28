"use client";
import Link from "next/link";
import { useCallback } from "react";
import MarkdownIt from "markdown-it";
import { useAuthContext } from "@festhub/frontend/auth";
import { Badge } from "@festhub/ui/components/badge";
import { Skeleton } from "@festhub/ui/components/skeleton";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  CodeIcon,
  TimerIcon,
} from "@festhub/ui/icons";
import {
  client,
  readResponse,
  loadPracticeBySlug,
  loadPracticeProblems,
  loadPracticeSamples,
} from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock } from "./status";
import { ProblemWorkspace } from "./problem-workspace";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
function formatDateTime(value: string | Date | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PracticeWorkspace({ slug }: { slug: string }) {
  const loader = useCallback(() => loadPracticeBySlug(slug), [slug]);
  const { data: contest, error, refresh } = usePoll(loader, 30000);
  const auth = useAuthContext();
  const contestId = contest?.id;
  const problemLoader = useCallback(
    () => loadPracticeProblems(contestId!),
    [contestId],
  );
  const sampleLoader = useCallback(
    (id: string, problemId: string) => loadPracticeSamples(id, problemId),
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
        await client.practice[":contestId"].problems[
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
      <LoadingBlock label="Loading practice…">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </LoadingBlock>
    );
  const past = contest.kind === "official";
  const starts = formatDateTime(contest.startsAt);
  const ends = formatDateTime(contest.endsAt);
  return (
    <div className="space-y-8">
      <Link
        href="/practice"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All practice
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex-1 basis-80 space-y-3">
          <Badge variant="outline" className="gap-1.5">
            <CodeIcon />
            {past ? "Past contest · Practice mode" : "Practice problem set"}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {contest.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2Icon className="size-4 shrink-0 text-brand" />
              {contest.solvedCount ?? 0} / {contest.problemCount ?? 0} solved
            </span>
            {starts && ends && (
              <span className="inline-flex items-center gap-2">
                <CalendarClockIcon className="size-4 shrink-0 text-brand" />
                {starts} — {ends}
              </span>
            )}
            {past && (
              <span className="inline-flex items-center gap-2">
                <TimerIcon className="size-4 shrink-0 text-brand" />
                Practice submissions do not affect official standings
              </span>
            )}
          </div>
        </div>
        <div className="min-w-48 rounded-xl border bg-card px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Your progress
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {contest.solvedCount ?? 0}
            <span className="text-base text-muted-foreground">
              /{contest.problemCount ?? 0}
            </span>
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
      <ProblemWorkspace
        contestId={contest.id}
        contestTitle={contest.title}
        contestHref={`/practice/${contest.slug}`}
        allowedLanguages={contest.allowedLanguages}
        canSubmit={auth.user?.role === "student"}
        practice
        loadProblems={problemLoader}
        loadSamples={sampleLoader}
        submit={submit}
      />
    </div>
  );
}
