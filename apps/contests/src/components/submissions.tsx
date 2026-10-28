"use client";
import { useCallback, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { cn } from "@festhub/ui/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon, InboxIcon } from "@festhub/ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@festhub/ui/components/table";
import {
  loadSubmission,
  loadSubmissions,
  loadPracticeSubmission,
  loadPracticeSubmissions,
  type Problem,
  type SubmissionDetail,
} from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock } from "./status";

const listInterval = (data: {
  submissions: Array<{ status: string }>;
}) =>
  data.submissions.some(
    (entry) => entry.status === "queued" || entry.status === "processing",
  )
    ? 2000
    : 10000;
export function VerdictBadge({
  status,
  verdict,
}: {
  status: string;
  verdict: string | null;
}) {
  const tone =
    verdict === "AC"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : status === "error" || (verdict && verdict !== "AC")
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : "bg-amber-50 text-amber-700 ring-amber-600/20";
  const inFlight = status === "queued" || status === "processing";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold capitalize ring-1 ring-inset",
        tone,
      )}
    >
      {inFlight && (
        <span className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
      )}
      {status === "error" ? "Judge error" : (verdict ?? status)}
    </span>
  );
}
export function Submissions({
  contestId,
  problems,
  selectedId,
  onSelect,
  revision,
  practice = false,
}: {
  contestId: string;
  problems: Problem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  revision: number;
  practice?: boolean;
}) {
  const [page, setPage] = useState(1);
  // Revision remounts the list after a new submission, including when it was already on page 1.
  return (
    <div className="space-y-6">
      <SubmissionList
        key={`${page}:${revision}`}
        contestId={contestId}
        problems={problems}
        page={page}
        setPage={setPage}
        onSelect={onSelect}
        practice={practice}
      />
      {selectedId && (
        <SubmissionPanel
          key={selectedId}
          contestId={contestId}
          id={selectedId}
          onClose={() => onSelect(null)}
          practice={practice}
        />
      )}
    </div>
  );
}
function SubmissionList({
  contestId,
  problems,
  page,
  setPage,
  onSelect,
  practice,
}: {
  contestId: string;
  problems: Problem[];
  page: number;
  setPage: (page: number) => void;
  onSelect: (id: string) => void;
  practice: boolean;
}) {
  const loader = useCallback(
    () =>
      practice
        ? loadPracticeSubmissions(contestId, page)
        : loadSubmissions(contestId, page),
    [contestId, page, practice],
  );
  const { data, error, refresh } = usePoll(loader, listInterval);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Your submissions</CardTitle>
        <CardDescription>
          {practice
            ? "Practice submissions are private to your account."
            : "For team contests, this includes submissions from your teammates."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && (
          <LoadingBlock label="Loading submissions…">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </LoadingBlock>
        )}
        {data && !data.submissions.length ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="size-5" />
            </span>
            No submissions yet.
          </div>
        ) : (
          data && (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Language ID</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(submission.submittedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {problems.find(
                          (problem) => problem.id === submission.problemId,
                        )?.title ?? "Problem"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {submission.languageCode}
                      </TableCell>
                      <TableCell>
                        <VerdictBadge
                          status={submission.status}
                          verdict={submission.verdict}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-brand hover:text-brand"
                          onClick={() => onSelect(submission.id)}
                        >
                          View
                          <ArrowRightIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ArrowLeftIcon />
            Previous
          </Button>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Page {page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ArrowRightIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
const isPending = (data: SubmissionDetail) =>
  data.status === "queued" || data.status === "processing";
function SubmissionPanel({
  contestId,
  id,
  onClose,
  practice,
}: {
  contestId: string;
  id: string;
  onClose: () => void;
  practice: boolean;
}) {
  const loader = useCallback(
    () =>
      practice
        ? loadPracticeSubmission(contestId, id)
        : loadSubmission(contestId, id),
    [contestId, id, practice],
  );
  const { data, error, refresh } = usePoll(loader, 2000, isPending);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">
          Submission details
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4" aria-live="polite">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && (
          <LoadingBlock label="Loading result…">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24" />
          </LoadingBlock>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-4">
              <VerdictBadge status={data.status} verdict={data.verdict} />
              <span className="text-sm font-medium">
                {data.passed}/{data.total} passed
              </span>
              <span className="text-sm text-muted-foreground">
                · {data.judged} judged
              </span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">Maximum time</dt>
                <dd className="font-mono tabular-nums">
                  {data.executionTime ?? "—"} s
                </dd>
              </div>
              <div className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">
                  Maximum memory
                </dt>
                <dd className="font-mono tabular-nums">
                  {data.memoryUsed ?? "—"} KiB
                </dd>
              </div>
            </dl>
            {data.status === "error" && (
              <p className="text-sm text-destructive">
                The judge could not finish this submission. Contact a contest
                organizer. This does not add a penalty.
              </p>
            )}
            {data.status === "completed" && data.judged < data.total && (
              <p className="text-sm text-muted-foreground">
                Judging stopped at the first failed test case. Remaining cases
                were skipped.
              </p>
            )}
            {data.compileOutput && (
              <div>
                <h3 className="mb-2 font-medium">Compiler output</h3>
                <pre className="max-h-80 overflow-auto rounded-xl border bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
                  {data.compileOutput}
                </pre>
              </div>
            )}
            <details className="group/source rounded-xl border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none hover:bg-muted/50">
                Source code
              </summary>
              <pre className="max-h-96 overflow-auto rounded-b-xl border-t bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                {data.sourceCode}
              </pre>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
