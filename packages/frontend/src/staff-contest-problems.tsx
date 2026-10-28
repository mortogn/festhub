"use client";

import { useState } from "react";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import { Label } from "@festhub/ui/components/label";
import { Textarea } from "@festhub/ui/components/textarea";
import { Switch } from "@festhub/ui/components/switch";
import {
  createProblemSchema,
  createTestCaseSchema,
} from "@festhub/shared/validation";
import client, { readResponse } from "./api";
import { useResource } from "./resource";
import { DeleteButton } from "./delete-button";
import {
  Editor,
  EmptyState,
  ResourceContent,
  Section,
  type FieldSpec,
} from "./ui";
import {
  loadContestLimits,
  problemLabel,
  type StaffContest,
  type StaffProblem,
  type StaffTestCase,
} from "./staff-contest-api";

type Props = {
  contest: StaffContest;
  problems: StaffProblem[];
  locked: boolean;
  practice?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: () => void;
};

export function ContestProblems({
  contest,
  problems,
  locked,
  practice = false,
  selectedId,
  onSelect,
  onChange,
}: Props) {
  const problem =
    problems.find((entry) => entry.id === selectedId) ??
    (selectedId === "new" ? undefined : problems[0]);
  return (
    <div className="space-y-4">
      {locked && (
        <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          The contest has started. Problems and test cases are read-only.
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Section
          title="Problems"
          action={<Badge variant="secondary">{problems.length}</Badge>}
        >
          <div className="space-y-3">
            <nav aria-label="Contest problems" className="space-y-2">
              {problems.map((entry) => (
                <Button
                  key={entry.id}
                  variant={problem?.id === entry.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start gap-2 px-3 py-3 text-left whitespace-normal"
                  onClick={() => onSelect(entry.id)}
                  aria-current={problem?.id === entry.id ? "page" : undefined}
                >
                  <span className="font-mono text-muted-foreground">
                    {problemLabel(entry.position)}.
                  </span>
                  <span className="min-w-0 break-words">{entry.title}</span>
                  <span className="sr-only">
                    , {entry.testCases.length} test cases
                  </span>
                </Button>
              ))}
            </nav>
            {!locked && (
              <Button
                variant="outline"
                className="w-full"
                disabled={!practice && contest.isActive}
                onClick={() => onSelect("new")}
              >
                Add problem
              </Button>
            )}
            {!practice && contest.isActive && !locked && (
              <p className="text-xs text-muted-foreground">
                Unpublish the contest to add a new problem.
              </p>
            )}
            {!problems.length && (
              <p className="text-sm text-muted-foreground">
                Create the first problem, then add its test cases.
              </p>
            )}
          </div>
        </Section>
        <div className="min-w-0 space-y-6">
          {problem ? (
            <>
              <Section
                title={`${problemLabel(problem.position)}. ${problem.title}`}
                description="Problem statement and execution limits."
                action={
                  !locked && (
                    <DeleteButton
                      label="Delete problem"
                      title={`Delete ${problem.title}?`}
                      description="This also deletes all test cases for this problem. This cannot be undone."
                      successMessage="Problem deleted."
                      action={async () => {
                        const param = {
                          contestId: contest.id,
                          problemId: problem.id,
                        };
                        return readResponse(
                          practice
                            ? await client.practice[":contestId"].problems[
                                ":problemId"
                              ].$delete({ param })
                            : await client.contests[":contestId"].problems[
                                ":problemId"
                              ].$delete({ param }),
                        );
                      }}
                      onSuccess={() => {
                        onSelect(
                          problems.find((entry) => entry.id !== problem.id)
                            ?.id ?? "new",
                        );
                        onChange();
                      }}
                    />
                  )
                }
              >
                {locked ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {problem.cpuLimitInSeconds} seconds ·{" "}
                      {problem.memoryLimitInKilobytes} KiB
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                      {problem.statement}
                    </pre>
                  </div>
                ) : (
                  <ProblemEditor
                    key={JSON.stringify(problem)}
                    contestId={contest.id}
                    problem={problem}
                    practice={practice}
                    onSaved={onChange}
                  />
                )}
              </Section>
              <TestCases
                key={problem.id}
                contestId={contest.id}
                problem={problem}
                locked={locked}
                practice={practice}
                onChange={onChange}
              />
            </>
          ) : !locked && (!contest.isActive || practice) ? (
            <Section
              title="New problem"
              description="Problems receive a stable letter in the order they are created."
            >
              <ProblemEditor
                contestId={contest.id}
                practice={practice}
                onSaved={(id) => {
                  onSelect(id);
                  onChange();
                }}
              />
            </Section>
          ) : (
            <EmptyState title="No problem selected" />
          )}
        </div>
      </div>
    </div>
  );
}

const statementTemplate = `## Problem statement

Describe the task here.

## Input

Describe the input format and constraints.

## Output

Describe the expected output.

## Constraints

- \`1 <= n <= 10^5\`
`;

function ProblemEditor({
  contestId,
  problem,
  practice = false,
  onSaved,
}: {
  contestId: string;
  problem?: StaffProblem;
  practice?: boolean;
  onSaved: (id: string) => void;
}) {
  const limits = useResource(loadContestLimits);
  const fields: FieldSpec[] = [
    { name: "title", label: "Problem title", required: true, fullWidth: true },
    {
      name: "statement",
      label: "Statement (Markdown)",
      type: "textarea",
      required: true,
      description:
        "Include the task, input format, output format, and constraints. Add examples as sample test cases below.",
    },
    {
      name: "cpuLimit",
      label: "CPU time (seconds)",
      type: "number",
      required: true,
      min: 1,
      max: limits.data ? Math.floor(limits.data.max_cpu_time_limit) : undefined,
    },
    {
      name: "memoryLimit",
      label: "Memory (KiB)",
      type: "number",
      required: true,
      min: 1,
      max: limits.data ? Math.floor(limits.data.max_memory_limit) : undefined,
      description: "1 MiB = 1024 KiB. For example, 128 MiB = 131072 KiB.",
    },
  ];
  return (
    <div className="space-y-4">
      {limits.data && (
        <p className="text-xs text-muted-foreground">
          Judge maximum: {limits.data.max_cpu_time_limit} seconds and{" "}
          {limits.data.max_memory_limit} KiB.
        </p>
      )}
      {limits.error && (
        <ResourceContent resource={limits}>
          <span />
        </ResourceContent>
      )}
      <Editor
        fields={fields}
        persistentErrors
        initialValues={{
          title: problem?.title ?? "",
          statement: problem?.statement ?? statementTemplate,
          cpuLimit: String(problem?.cpuLimitInSeconds ?? 2),
          memoryLimit: String(problem?.memoryLimitInKilobytes ?? 131072),
        }}
        submitLabel={problem ? "Save problem" : "Create problem"}
        successMessage={problem ? "Problem saved." : "Problem created."}
        onSubmit={async (values) => {
          const body = createProblemSchema.parse({
            title: values.title,
            statement: values.statement,
            cpuLimit: Number(values.cpuLimit),
            memoryLimit: Number(values.memoryLimit),
          });
          if (problem) {
            const response = practice
              ? await client.practice[":contestId"].problems[
                  ":problemId"
                ].$put({
                  param: { contestId, problemId: problem.id },
                  json: body,
                })
              : await client.contests[":contestId"].problems[
                  ":problemId"
                ].$put({
                  param: { contestId, problemId: problem.id },
                  json: body,
                });
            await readResponse(response);
            onSaved(problem.id);
          } else {
            const response = practice
              ? await client.practice[":contestId"].problems.$post({
                  param: { contestId },
                  json: body,
                })
              : await client.contests[":contestId"].problems.$post({
                  param: { contestId },
                  json: body,
                });
            const created = await readResponse(response);
            onSaved(created.id);
          }
        }}
      />
    </div>
  );
}

function TestCases({
  contestId,
  problem,
  locked,
  practice = false,
  onChange,
}: {
  contestId: string;
  problem: StaffProblem;
  locked: boolean;
  practice?: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(problem.testCases.length === 0);
  const [bulk, setBulk] = useState(false);
  const [newSample, setNewSample] = useState(false);
  const nextPosition =
    Math.max(0, ...problem.testCases.map((testCase) => testCase.position)) + 1;
  const startAdding = (sample: boolean) => {
    setEditing(null);
    setBulk(false);
    setNewSample(sample);
    setAdding(true);
  };
  return (
    <Section
      title="Test cases"
      description="Run in position order. Samples are visible to participants; hidden cases are used only for judging."
      action={
        !locked && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => startAdding(true)}
            >
              Add sample
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startAdding(false)}
            >
              Add hidden case
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(null);
                setAdding(false);
                setBulk((value) => !value);
              }}
            >
              Paste test cases
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {!problem.testCases.length && !adding && (
          <EmptyState
            title="No test cases yet"
            description="Add at least one case before publishing."
          />
        )}
        {problem.testCases.map((testCase) => (
          <article
            key={testCase.id}
            className="min-w-0 space-y-4 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">
                  Case {testCase.position}
                </h3>
                <Badge variant={testCase.isSample ? "secondary" : "outline"}>
                  {testCase.isSample ? "Sample" : "Hidden"}
                </Badge>
              </div>
              {!locked && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdding(false);
                      setEditing(editing === testCase.id ? null : testCase.id);
                    }}
                  >
                    {editing === testCase.id ? "Cancel" : "Edit"}
                  </Button>
                  <DeleteButton
                    label={`Delete test case ${testCase.position}`}
                    title={`Delete test case ${testCase.position}?`}
                    description="The input and expected output will be permanently removed."
                    successMessage="Test case deleted."
                    action={async () => {
                      const param = {
                        contestId,
                        problemId: problem.id,
                        testCaseId: testCase.id,
                      };
                      return practice
                        ? readResponse(
                            await client.practice[":contestId"].problems[
                              ":problemId"
                            ].testcases[":testCaseId"].$delete({ param }),
                          )
                        : readResponse(
                            await client.contests[":contestId"].problems[
                              ":problemId"
                            ].testcases[":testCaseId"].$delete({ param }),
                          );
                    }}
                    onSuccess={onChange}
                  />
                </div>
              )}
            </div>
            {editing === testCase.id && !locked ? (
              <TestCaseEditor
                contestId={contestId}
                problemId={problem.id}
                testCase={testCase}
                nextPosition={nextPosition}
                practice={practice}
                onSaved={onChange}
              />
            ) : (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <CaseText label="Input" value={testCase.stdin} />
                <CaseText label="Expected output" value={testCase.stdout} />
              </div>
            )}
          </article>
        ))}
        {adding && !locked && (
          <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">
                New {newSample ? "sample" : "hidden"} test case
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
            <TestCaseEditor
              key={`${nextPosition}:${newSample}`}
              contestId={contestId}
              problemId={problem.id}
              nextPosition={nextPosition}
              defaultSample={newSample}
              practice={practice}
              onSaved={onChange}
            />
          </div>
        )}
        {bulk && !locked && (
          <BulkTestCases
            key={`bulk:${nextPosition}`}
            contestId={contestId}
            problemId={problem.id}
            nextPosition={nextPosition}
            practice={practice}
            onSaved={onChange}
            onClose={() => setBulk(false)}
          />
        )}
      </div>
    </Section>
  );
}

function CaseText({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs whitespace-pre">
        {value || <span className="text-muted-foreground">(empty)</span>}
      </pre>
    </div>
  );
}

function parseBulkCases(value: string) {
  const blocks = value
    .replace(/\r\n/g, "\n")
    .split(/\n-{3,}\n/)
    .map((block) => block.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean);
  if (!blocks.length) throw new Error("Paste at least one test case.");
  return blocks.map((block, index) => {
    const match = block.match(/^([\s\S]*?)\n={3,}(?:\n([\s\S]*))?$/);
    if (!match)
      throw new Error(
        `Case ${index + 1} needs a line with === between input and expected output.`,
      );
    return {
      stdin: match[1]!.replace(/^\n+|\n+$/g, ""),
      stdout: (match[2] ?? "").replace(/^\n+|\n+$/g, ""),
    };
  });
}

function BulkTestCases({
  contestId,
  problemId,
  nextPosition,
  practice,
  onSaved,
  onClose,
}: {
  contestId: string;
  problemId: string;
  nextPosition: number;
  practice: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [sample, setSample] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setPending(true);
    setError(null);
    try {
      const cases = parseBulkCases(value);
      for (const [index, testCase] of cases.entries()) {
        const body = createTestCaseSchema.parse({
          position: nextPosition + index,
          isSample: sample,
          stdin: testCase.stdin,
          stdout: testCase.stdout,
        });
        const param = { contestId, problemId };
        if (practice)
          await readResponse(
            await client.practice[":contestId"].problems[
              ":problemId"
            ].testcases.$post({ param, json: body }),
          );
        else
          await readResponse(
            await client.contests[":contestId"].problems[
              ":problemId"
            ].testcases.$post({ param, json: body }),
          );
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add cases.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Paste test cases</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Put <code className="font-mono">===</code> between input and
            expected output, then <code className="font-mono">---</code> between
            cases. Positions are assigned automatically.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`bulk-${problemId}`}>Test cases</Label>
        <Textarea
          id={`bulk-${problemId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
          placeholder={"1 2\n===\n3\n---\n4 5\n===\n9"}
          className="min-h-48 font-mono text-sm"
          disabled={pending}
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch
          checked={sample}
          onCheckedChange={setSample}
          disabled={pending}
        />
        Visible samples
      </label>
      {error && (
        <p role="alert" className="text-sm whitespace-pre-line text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        onClick={submit}
        disabled={pending || !value.trim()}
        className="h-11"
      >
        {pending ? "Adding…" : "Add test cases"}
      </Button>
    </div>
  );
}

function TestCaseEditor({
  contestId,
  problemId,
  testCase,
  nextPosition,
  defaultSample = false,
  practice = false,
  onSaved,
}: {
  contestId: string;
  problemId: string;
  testCase?: StaffTestCase;
  nextPosition: number;
  defaultSample?: boolean;
  practice?: boolean;
  onSaved: () => void;
}) {
  return (
    <div className="[&_textarea]:min-h-36 [&_textarea]:font-mono [&_textarea]:text-sm">
      <Editor
        persistentErrors
        fields={[
          {
            name: "position",
            label: "Position",
            type: "number",
            min: 1,
            required: true,
            description:
              "Lower positions run first. Each position must be unique within this problem.",
          },
          {
            name: "isSample",
            label: "Visible sample",
            type: "switch",
            description: "Show this input and expected output to participants.",
          },
          {
            name: "stdin",
            label: "Input",
            type: "textarea",
            description: "Empty input is allowed. Whitespace is preserved.",
          },
          {
            name: "stdout",
            label: "Expected output",
            type: "textarea",
            description:
              "Compared as exact whitespace-separated tokens. Empty output is allowed.",
          },
        ]}
        initialValues={{
          position: String(testCase?.position ?? nextPosition),
          isSample: String(testCase?.isSample ?? defaultSample),
          stdin: testCase?.stdin ?? "",
          stdout: testCase?.stdout ?? "",
        }}
        submitLabel={testCase ? "Save test case" : "Add test case"}
        successMessage="Test case saved."
        onSubmit={async (values) => {
          const body = createTestCaseSchema.parse({
            position: Number(values.position),
            isSample: values.isSample === "true",
            stdin: values.stdin ?? "",
            stdout: values.stdout ?? "",
          });
          if (testCase) {
            const param = { contestId, problemId, testCaseId: testCase.id };
            if (practice)
              await readResponse(
                await client.practice[":contestId"].problems[
                  ":problemId"
                ].testcases[":testCaseId"].$put({ param, json: body }),
              );
            else
              await readResponse(
                await client.contests[":contestId"].problems[
                  ":problemId"
                ].testcases[":testCaseId"].$put({ param, json: body }),
              );
          } else if (practice)
            await readResponse(
              await client.practice[":contestId"].problems[
                ":problemId"
              ].testcases.$post({
                param: { contestId, problemId },
                json: body,
              }),
            );
          else
            await readResponse(
              await client.contests[":contestId"].problems[
                ":problemId"
              ].testcases.$post({
                param: { contestId, problemId },
                json: body,
              }),
            );
          onSaved();
        }}
      />
    </div>
  );
}
