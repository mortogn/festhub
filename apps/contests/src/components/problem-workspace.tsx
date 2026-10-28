"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import MarkdownIt from "markdown-it";
import { useAuthContext } from "@festhub/frontend/auth";
import { errorMessage } from "@festhub/frontend/api";
import { Button } from "@festhub/ui/components/button";
import { Label } from "@festhub/ui/components/label";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { Textarea } from "@festhub/ui/components/textarea";
import {
  CheckCircle2Icon,
  ClockIcon,
  CodeIcon,
  ListChecksIcon,
  SendIcon,
  TimerIcon,
  TrophyIcon,
} from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
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
import { loadLanguages, type Problem } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { getPreferredLanguage, setPreferredLanguage } from "@/lib/preferences";
import { ErrorState } from "./shell";
import { LoadingBlock } from "./status";
import { Submissions } from "./submissions";
import { useSubmissionTracker } from "./submission-tracker";
import { StandingsTable } from "./standings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@festhub/ui/components/dialog";

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
export type ProblemView = Problem & { solved?: boolean; attempts?: number };
export type ProblemLoader = () => Promise<{
  problems: ProblemView[];
  kind?: string;
}>;
export type SampleLoader = (
  contestId: string,
  problemId: string,
) => Promise<{
  testCases: Array<{
    id: string;
    stdin: string;
    stdout: string;
    position: number;
    isSample: boolean | null;
  }>;
}>;
export type SubmissionHandler = (
  contestId: string,
  problemId: string,
  sourceCode: string,
  languageCode: number,
) => Promise<{ id: string }>;

export function ProblemWorkspace({
  contestId,
  contestTitle,
  contestHref,
  allowedLanguages,
  canSubmit,
  practice = false,
  showStandings = false,
  loadProblems,
  loadSamples,
  submit,
}: {
  contestId: string;
  contestTitle: string;
  contestHref: string;
  allowedLanguages: number[] | null;
  canSubmit: boolean;
  practice?: boolean;
  showStandings?: boolean;
  loadProblems: ProblemLoader;
  loadSamples: SampleLoader;
  submit: SubmissionHandler;
}) {
  const loader = useCallback(() => loadProblems(), [loadProblems]);
  const { data, error, refresh } = usePoll(loader);
  const { track } = useSubmissionTracker();
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
  const tabs = [
    { value: "problems", label: "Problems", icon: CodeIcon },
    { value: "submissions", label: "Submissions", icon: ListChecksIcon },
    ...(showStandings
      ? [{ value: "standings", label: "Standings", icon: TrophyIcon }]
      : []),
  ];
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList
        variant="line"
        className="h-11! w-full justify-start gap-2 overflow-x-auto border-b p-0"
      >
        {tabs.map(({ value, label, icon: Icon }) => (
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
              aria-label="Problems"
              className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0"
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
                    <span className="min-w-0 flex-1 truncate">
                      {entry.title}
                    </span>
                    {practice && entry.solved && (
                      <CheckCircle2Icon
                        aria-label="Solved"
                        className="size-4 shrink-0 text-emerald-600"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="min-w-0 space-y-6">
              <ProblemStatement
                key={`statement-${problem.id}`}
                contestId={contestId}
                problem={problem}
                loadSamples={loadSamples}
                submissionForm={
                  <SubmissionForm
                    key={`submission-${problem.id}`}
                    contestId={contestId}
                    problem={problem}
                    allowedLanguages={allowedLanguages}
                    canSubmit={canSubmit}
                    practice={practice}
                    submit={submit}
                    onSubmitted={(id) => {
                      track({
                        id,
                        contestId,
                        practice,
                        href: contestHref,
                        contestTitle,
                        problemLabel: problemLabel(problem.position),
                        problemTitle: problem.title,
                      });
                      setSubmissionId(id);
                      setRevision((n) => n + 1);
                      setTab("submissions");
                    }}
                  />
                }
              />
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="submissions">
        <Submissions
          contestId={contestId}
          problems={data.problems}
          selectedId={submissionId}
          onSelect={setSubmissionId}
          revision={revision}
          practice={practice}
        />
      </TabsContent>
      {showStandings && (
        <TabsContent value="standings">
          <StandingsTable contestId={contestId} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function ProblemStatement({
  contestId,
  problem,
  loadSamples,
  submissionForm,
}: {
  contestId: string;
  problem: ProblemView;
  loadSamples: SampleLoader;
  submissionForm?: React.ReactNode;
}) {
  const loader = useCallback(
    () => loadSamples(contestId, problem.id),
    [contestId, problem.id, loadSamples],
  );
  const { data, error, refresh } = usePoll(loader);
  return (
    <Card className="overflow-visible pt-0">
      <CardHeader className="sticky top-0 bg-card pt-(--card-spacing)">
        <div className="border-b pb-6 flex items-center justify-between">
          <div className="space-y-3">
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
              {!!problem.attempts && (
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                  <ClockIcon className="size-3.5" />
                  {problem.attempts} attempt{problem.attempts === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          {submissionForm}
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
  contestId,
  problem,
  allowedLanguages,
  canSubmit,
  practice,
  submit,
  onSubmitted,
}: {
  contestId: string;
  problem: ProblemView;
  allowedLanguages: number[] | null;
  canSubmit: boolean;
  practice: boolean;
  submit: SubmissionHandler;
  onSubmitted: (id: string) => void;
}) {
  const { user } = useAuthContext();
  const { data, error, refresh } = usePoll(loadLanguages);
  const [language, setLanguage] = useState(() =>
    getPreferredLanguage(user?.id),
  );
  const languages = data?.filter(
    (entry) => !allowedLanguages || allowedLanguages.includes(entry.id),
  );
  const languageCode = languages?.some((entry) => String(entry.id) === language)
    ? language
    : String(languages?.[0]?.id ?? "");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <SendIcon />
          Submit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-4rem)] w-full sm:max-w-160 md:max-w-180  overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold ">
            <SendIcon className="size-4 text-brand" />
            Submit a solution
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <ErrorState message={error} retry={refresh} />}
          {!canSubmit && (
            <p className="rounded-xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
              {practice
                ? "Sign in as a student to submit practice solutions."
                : "Submissions are available to participants during the contest."}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={languageCode}
              onValueChange={(value) => {
                setLanguage(value);
                setPreferredLanguage(user?.id, value);
              }}
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
              key={`${user.id}:${contestId}:${problem.id}:${languageCode}`}
              draftKey={`festhub:code:${user.id}:${contestId}:${problem.id}:${languageCode}`}
              contestId={contestId}
              problemId={problem.id}
              languageCode={Number(languageCode)}
              canSubmit={canSubmit}
              submit={submit}
              onSubmitted={(id) => {
                setPreferredLanguage(user.id, languageCode);
                onSubmitted(id);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CodeInput({
  draftKey,
  contestId,
  problemId,
  languageCode,
  canSubmit,
  submit,
  onSubmitted,
}: {
  draftKey: string;
  contestId: string;
  problemId: string;
  languageCode: number;
  canSubmit: boolean;
  submit: SubmissionHandler;
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
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      const result = await submit(contestId, problemId, code, languageCode);
      onSubmitted(result.id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor="source-code">Source code</Label>
        <Textarea
          id="source-code"
          value={code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-80 resize-y rounded-md border-border bg-secondary p-4 font-mono text-sm leading-relaxed text-secondary-foreground placeholder:text-muted-foreground "
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
