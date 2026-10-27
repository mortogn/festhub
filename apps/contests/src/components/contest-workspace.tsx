"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import MarkdownIt from "markdown-it";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { Textarea } from "@festhub/ui/components/textarea";
import {
  Card,
  CardContent,
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

export function ContestWorkspace({ slug }: { slug: string }) {
  const loader = useCallback(() => loadContest(slug), [slug]);
  const { data: contest, error, refresh } = usePoll(loader, 15000);
  const auth = useAuthContext();
  const now = useClock();
  if (!contest)
    return error ? (
      <ErrorState message={error} retry={refresh} />
    ) : (
      <p role="status">Loading contest…</p>
    );
  const starts = new Date(contest.startsAt).getTime();
  const ends = new Date(contest.endsAt).getTime();
  const staff = auth.user?.role === "teacher" || auth.user?.role === "admin";
  return (
    <div className="space-y-7">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All contests
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-2">
          <Badge variant="secondary">
            {now < starts
              ? "Upcoming"
              : now >= ends
                ? "Finished"
                : "Live contest"}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">
            {contest.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(starts).toLocaleString()} —{" "}
            {new Date(ends).toLocaleTimeString()}
          </p>
        </div>
        <div className="rounded-lg border px-5 py-3 text-right">
          <p className="text-xs text-muted-foreground">
            {now < starts
              ? "Starts in"
              : now >= ends
                ? "Contest finished"
                : "Time remaining"}
          </p>
          <p className="font-mono text-2xl tabular-nums">
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
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
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
        <CardTitle>Enter contest password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="contest-password">Contest password</Label>
          <Input
            id="contest-password"
            name="password"
            type="password"
            autoComplete="off"
            required
            maxLength={72}
            disabled={pending}
          />
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
      <p role="status">Loading problems…</p>
    );
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="problems">Problems</TabsTrigger>
        <TabsTrigger value="submissions">Submissions</TabsTrigger>
        <TabsTrigger value="standings">Standings</TabsTrigger>
      </TabsList>
      <TabsContent value="problems">
        {!problem ? (
          <p className="py-8 text-muted-foreground">
            No problems have been published.
          </p>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav
              aria-label="Contest problems"
              className="flex flex-wrap gap-2 lg:flex-col"
            >
              {data.problems.map((entry) => (
                <Button
                  key={entry.id}
                  variant={entry.id === problem.id ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => setSelected(entry.id)}
                >
                  {problemLabel(entry.position)}. {entry.title}
                </Button>
              ))}
            </nav>
            <div className="min-w-0 space-y-6">
              <ProblemStatement
                key={problem.id}
                contestId={contest.id}
                problem={problem}
              />
              <SubmissionForm
                key={problem.id}
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
      <CardHeader>
        <CardTitle className="text-2xl">
          {problemLabel(problem.position)}. {problem.title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Time limit: {problem.cpuLimitInSeconds} s · Memory limit:{" "}
          {problem.memoryLimitInKilobytes / 1024} MiB
        </p>
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
            <div key={sample.id} className="space-y-2">
              <h3 className="font-medium">Sample {i + 1}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Input</p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {sample.stdin || "(empty)"}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Output</p>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
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
        <CardTitle>Submit a solution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!canSubmit && (
          <p className="text-sm text-muted-foreground">
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
      <Label htmlFor="source-code">Source code</Label>
      <Textarea
        id="source-code"
        value={code}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="min-h-80 resize-y font-mono text-sm"
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
      <p className="text-xs text-muted-foreground">
        {storageError
          ? "Draft storage is unavailable in this browser. Keep a copy of your code."
          : "Draft saved in this browser as you type."}{" "}
        Maximum 64 KiB.
      </p>
      {error && <ErrorState message={error} />}
      <Button disabled={pending || !canSubmit || !code.trim()}>
        {pending ? "Submitting…" : "Submit solution"}
      </Button>
    </form>
  );
}
