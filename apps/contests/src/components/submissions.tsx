"use client";
import { useCallback, useState } from "react";
import { Badge } from "@festhub/ui/components/badge";
import { Button } from "@festhub/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@festhub/ui/components/table";
import {
  loadSubmissions,
  loadSubmission,
  type Problem,
  type SubmissionDetail,
} from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";

const listInterval = (data: Awaited<ReturnType<typeof loadSubmissions>>) =>
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
  return (
    <Badge
      variant={
        verdict === "AC"
          ? "default"
          : status === "error" || (verdict && verdict !== "AC")
            ? "destructive"
            : "secondary"
      }
    >
      {status === "error" ? "Judge error" : (verdict ?? status)}
    </Badge>
  );
}
export function Submissions({
  contestId,
  problems,
  selectedId,
  onSelect,
  revision,
}: {
  contestId: string;
  problems: Problem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  revision: number;
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
      />
      {selectedId && (
        <SubmissionPanel
          key={selectedId}
          contestId={contestId}
          id={selectedId}
          onClose={() => onSelect(null)}
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
}: {
  contestId: string;
  problems: Problem[];
  page: number;
  setPage: (page: number) => void;
  onSelect: (id: string) => void;
}) {
  const loader = useCallback(
    () => loadSubmissions(contestId, page),
    [contestId, page],
  );
  const { data, error, refresh } = usePoll(loader, listInterval);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your submissions</CardTitle>
        <p className="text-sm text-muted-foreground">
          For team contests, this includes submissions from your teammates.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && <p role="status">Loading submissions…</p>}
        {data && !data.submissions.length ? (
          <p className="py-6 text-muted-foreground">No submissions yet.</p>
        ) : (
          data && (
            <Table>
              <TableHeader>
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
                    <TableCell className="text-xs">
                      {new Date(submission.submittedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {problems.find(
                        (problem) => problem.id === submission.problemId,
                      )?.title ?? "Problem"}
                    </TableCell>
                    <TableCell>{submission.languageCode}</TableCell>
                    <TableCell>
                      <VerdictBadge
                        status={submission.status}
                        verdict={submission.verdict}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelect(submission.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
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
}: {
  contestId: string;
  id: string;
  onClose: () => void;
}) {
  const loader = useCallback(
    () => loadSubmission(contestId, id),
    [contestId, id],
  );
  const { data, error, refresh } = usePoll(loader, 2000, isPending);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Submission details</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4" aria-live="polite">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && <p role="status">Loading result…</p>}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <VerdictBadge status={data.status} verdict={data.verdict} />
              <span className="text-sm text-muted-foreground">
                {data.passed}/{data.total} passed · {data.judged} judged
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Maximum time: {data.executionTime ?? "—"} s · Maximum memory:{" "}
              {data.memoryUsed ?? "—"} KiB
            </p>
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
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">
                  {data.compileOutput}
                </pre>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-sm">Source code</summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
                {data.sourceCode}
              </pre>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
