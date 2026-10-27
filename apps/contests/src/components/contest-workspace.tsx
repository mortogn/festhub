"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import MarkdownIt from "markdown-it";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { Textarea } from "@festhub/ui/components/textarea";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  ClockIcon,
  CodeIcon,
  ListChecksIcon,
  LockIcon,
  SendIcon,
  TimerIcon,
  TrophyIcon,
} from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@festhub/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import {
  client,
  readResponse,
  loadContest,
  loadLanguages,
  loadProblems,
  loadSamples,
  type Contest,
  type Problem,
} from "@/lib/api";
import { usePoll, useClock } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock, PhaseBadge, contestPhase } from "./status";
import { Submissions } from "./submissions";
import { StandingsTable } from "./standings";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
export const problemLabel = (position: number) => {
  let value = position;
  let label = "";
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};
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
  const starts = new Date(contest.startsAt).getTime();
  const ends = new Date(contest.endsAt).getTime();
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
        <ContestContent
          contest={contest}
          canSubmit={
            auth.user?.role === "student" &&
            now >= starts &&
            now < ends &&
            contest.isActive
          }
        />
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
  async function submit(event: FormEvent<HTMLFormElement>) {
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
        <form onSubmit={submit} className="space-y-4">
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
function ContestContent({
  contest,
  canSubmit,
}: {
  contest: Contest;
  canSubmit: boolean;
}) {
  const loader = useCallback(() => loadProblems(contest.id), [contest.id]);
  const { data, error, refresh } = usePoll(loader);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("problems");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const problem =
    data?.problems.find((entry) => entry.id === selected) ?? data?.problems[0];
  if (!data)
    return error ? (
      <ErrorState message={error} retry={refresh} />
    ) : (
      <LoadingBlock label="Loading problems…">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-72 rounded-xl" />
      </LoadingBlock>
    );
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList
        variant="line"
        className="h-11! w-full justify-start gap-2 overflow-x-auto border-b p-0"
      >
        {[
          { value: "problems", label: "Problems", icon: CodeIcon },
          { value: "submissions", label: "Submissions", icon: ListChecksIcon },
          { value: "standings", label: "Standings", icon: TrophyIcon },
        ].map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-full! flex-none gap-2 px-4 text-sm after:bottom-[-1px]! after:h-0.5 after:bg-brand! data-active:text-brand!"
          >
            <Icon />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="problems">
        {!problem ? (
          <p className="py-8 text-muted-foreground">
            No problems have been published.
          </p>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav
              aria-label="Contest problems"
              className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {data.problems.map((entry) => {
                const active = entry.id === problem.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => setSelected(entry.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-brand/30 bg-brand-soft text-foreground shadow-xs"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold",
                        active
                          ? "bg-brand text-brand-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {problemLabel(entry.position)}
                    </span>
                    <span className="truncate">{entry.title}</span>
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 space-y-6">
              <ProblemStatement
                key={`statement-${problem.id}`}
                contestId={contest.id}
                problem={problem}
              />
              <SubmissionForm
                key={`submission-${problem.id}`}
                contest={contest}
                problem={problem}
                canSubmit={canSubmit}
                onSubmitted={(id) => {
                  setSubmissionId(id);
                  setRevision((n) => n + 1);
                  setTab("submissions");
                }}
              />
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="submissions">
        <Submissions
          contestId={contest.id}
          problems={data.problems}
          selectedId={submissionId}
          onSelect={setSubmissionId}
          revision={revision}
        />
      </TabsContent>
      <TabsContent value="standings">
        <StandingsTable contestId={contest.id} />
      </TabsContent>
    </Tabs>
  );
}
function ProblemStatement({
  contestId,
  problem,
}: {
  contestId: string;
  problem: Problem;
}) {
  const loader = useCallback(
    () => loadSamples(contestId, problem.id),
    [contestId, problem.id],
  );
  const { data, error, refresh } = usePoll(loader);
  return (
    <Card>
      <CardHeader className="gap-3 border-b pb-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand font-mono text-lg font-semibold text-brand-foreground">
            {problemLabel(problem.position)}
          </span>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {problem.title}
          </CardTitle>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            <TimerIcon className="size-3.5" />
            Time limit: {problem.cpuLimitInSeconds} s
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            <CodeIcon className="size-3.5" />
            Memory limit: {problem.memoryLimitInKilobytes / 1024} MiB
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <article
          className="statement text-sm"
          dangerouslySetInnerHTML={{
            __html: markdown.render(problem.statement),
          }}
        />
        {error && <ErrorState message={error} retry={refresh} />}
        {data?.testCases
          .filter((entry) => entry.isSample)
          .map((sample, i) => (
            <div key={sample.id} className="space-y-3">
              <h3 className="text-sm font-semibold">Sample {i + 1}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="overflow-hidden rounded-xl border">
                  <p className="border-b bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Input
                  </p>
                  <pre className="overflow-x-auto p-3 font-mono text-xs">
                    {sample.stdin || "(empty)"}
                  </pre>
                </div>
                <div className="overflow-hidden rounded-xl border">
                  <p className="border-b bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Output
                  </p>
                  <pre className="overflow-x-auto p-3 font-mono text-xs">
                    {sample.stdout || "(empty)"}
                  </pre>
                </div>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
function SubmissionForm({
  contest,
  problem,
  canSubmit,
  onSubmitted,
}: {
  contest: Contest;
  problem: Problem;
  canSubmit: boolean;
  onSubmitted: (id: string) => void;
}) {
  const { user } = useAuthContext();
  const { data, error, refresh } = usePoll(loadLanguages);
  const [language, setLanguage] = useState("");
  const languages = data?.filter(
    (entry) =>
      !contest.allowedLanguages || contest.allowedLanguages.includes(entry.id),
  );
  const languageCode = languages?.some((entry) => String(entry.id) === language)
    ? language
    : String(languages?.[0]?.id ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <SendIcon className="size-4 text-brand" />
          Submit a solution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!canSubmit && (
          <p className="rounded-xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
            Submissions are available to participants during the contest.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={languageCode}
            onValueChange={setLanguage}
            disabled={!languages?.length}
          >
            <SelectTrigger id="language" className="w-full sm:w-80">
              <SelectValue
                placeholder={
                  data ? "No allowed languages" : "Loading languages…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {languages?.map((entry) => (
                <SelectItem key={entry.id} value={String(entry.id)}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {user && languageCode && (
          <CodeInput
            key={`${user.id}:${contest.id}:${problem.id}:${languageCode}`}
            draftKey={`festhub:code:${user.id}:${contest.id}:${problem.id}:${languageCode}`}
            contestId={contest.id}
            problemId={problem.id}
            languageCode={Number(languageCode)}
            canSubmit={canSubmit}
            onSubmitted={onSubmitted}
          />
        )}
      </CardContent>
    </Card>
  );
}
function CodeInput({
  draftKey,
  contestId,
  problemId,
  languageCode,
  canSubmit,
  onSubmitted,
}: {
  draftKey: string;
  contestId: string;
  problemId: string;
  languageCode: number;
  canSubmit: boolean;
  onSubmitted: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Browser-only persistence is loaded after hydration. Never save the initial empty render.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(localStorage.getItem(draftKey) ?? "");
    } catch {
      setStorageError(true);
    }
  }, [draftKey]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setError("Enter your source code.");
      return;
    }
    if (new TextEncoder().encode(code).length > 65536) {
      setError("Source code must not exceed 64 KiB.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await readResponse(
        await client.contests[":contestId"].problems[
          ":problemId"
        ].submission.$post({
          param: { contestId, problemId },
          json: { sourceCode: code, languageCode },
        }),
      );
      onSubmitted(result.id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor="source-code">Source code</Label>
        <Textarea
          id="source-code"
          value={code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-80 resize-y rounded-xl border-slate-800 bg-slate-950 p-4 font-mono text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 dark:bg-slate-950"
          placeholder="Write or paste your solution here…"
          onChange={(event) => {
            const value = event.target.value;
            setCode(value);
            try {
              localStorage.setItem(draftKey, value);
            } catch {
              setStorageError(true);
            }
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {storageError
          ? "Draft storage is unavailable in this browser. Keep a copy of your code."
          : "Draft saved in this browser as you type."}{" "}
        Maximum 64 KiB.
      </p>
      {error && <ErrorState message={error} />}
      <Button
        className="h-10 px-4"
        disabled={pending || !canSubmit || !code.trim()}
      >
        <SendIcon />
        {pending ? "Submitting…" : "Submit solution"}
      </Button>
    </form>
  );
}
