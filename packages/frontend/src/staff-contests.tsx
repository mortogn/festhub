"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@festhub/ui/components/button";
import { Input } from "@festhub/ui/components/input";
import { Textarea } from "@festhub/ui/components/textarea";
import { Label } from "@festhub/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@festhub/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@festhub/ui/components/tabs";
import { toast } from "@festhub/ui/components/sonner";
import {
  createContestSchema,
  createProblemSetSchema,
  updateContestSchema,
  updateProblemSetSchema,
} from "@festhub/shared/validation";
import client, { errorMessage, readResponse } from "./api";
import { formatDateTime, fromDateInput, toDateInput } from "./dates";
import { useResource } from "./resource";
import {
  EmptyState,
  MutationButton,
  PageHeading,
  ResourceContent,
  SearchInput,
  Section,
  StatusBadge,
} from "./ui";
import {
  contestHref,
  loadContestEditor,
  loadContestEvents,
  loadContestLanguages,
  loadStaffContests,
  loadStaffPractice,
  type ContestEditor,
  type StaffContest,
} from "./staff-contest-api";
import { ContestProblems } from "./staff-contest-problems";

function useContestClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function StaffContestsPage() {
  const contests = useResource(loadStaffContests);
  const practice = useResource(loadStaffPractice);
  const [view, setView] = useState<"official" | "practice">("official");
  const [search, setSearch] = useState("");
  const now = useContestClock();
  const items = (
    view === "official"
      ? (contests.data?.contests ?? [])
      : (practice.data?.problemSets ?? [])
  ) as StaffContest[];
  const filtered = items.filter((contest) =>
    `${contest.title} ${contest.slug}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const activeResource = view === "official" ? contests : practice;
  return (
    <div className="space-y-6">
      <PageHeading
        title="Programming contests"
        description="Prepare official contests and practice problem sets for your students."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/contests/create?kind=problem_set">
                Create problem set
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/contests/create">Create contest</Link>
            </Button>
          </div>
        }
      />
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as typeof view)}
      >
        <TabsList>
          <TabsTrigger value="official">Official contests</TabsTrigger>
          <TabsTrigger value="practice">Practice problem sets</TabsTrigger>
        </TabsList>
      </Tabs>
      <SearchInput
        aria-label="Search contests"
        placeholder={
          view === "official"
            ? "Search official contests"
            : "Search problem sets"
        }
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ResourceContent resource={activeResource}>
        {filtered.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((contest) => (
              <article
                key={contest.id}
                className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="font-semibold break-words">
                      <Link
                        href={contestHref(contest.id)}
                        className="hover:underline"
                      >
                        {contest.title}
                      </Link>
                    </h2>
                    <p className="text-xs break-all text-muted-foreground">
                      /{view === "official" ? "contests" : "practice"}/
                      {contest.slug}
                    </p>
                  </div>
                  <StatusBadge
                    status={contest.isActive ? "published" : "draft"}
                  />
                </div>
                {view === "official" ? (
                  <p className="text-sm text-muted-foreground">
                    {contest.startsAt
                      ? formatDateTime(contest.startsAt)
                      : "No schedule"}{" "}
                    –{" "}
                    {contest.endsAt ? formatDateTime(contest.endsAt) : "No end"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {contest.problemCount ?? 0} problem
                    {(contest.problemCount ?? 0) === 1 ? "" : "s"} · Open to all
                    signed-in students
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {view === "official" ? (
                      <>
                        {contest.startsAt &&
                        now < Date.parse(String(contest.startsAt))
                          ? "Upcoming"
                          : contest.endsAt &&
                              now < Date.parse(String(contest.endsAt))
                            ? "Running"
                            : "Ended"}
                        {contest.hasPassword ? " · Password required" : ""}
                      </>
                    ) : (
                      "Practice progress is tracked per student"
                    )}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={contestHref(contest.id)}>
                      {view === "official"
                        ? "Manage contest"
                        : "Manage problem set"}
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              search
                ? "No matching items"
                : view === "official"
                  ? "No programming contests yet"
                  : "No practice problem sets yet"
            }
            description={
              view === "official"
                ? "Link a contest to an event, then prepare its problems and test cases."
                : "Create a problem set, add problems and test cases, then publish it for practice."
            }
          />
        )}
      </ResourceContent>
    </div>
  );
}

export function StaffCreateContestPage() {
  const params = useSearchParams();
  const router = useRouter();
  const events = useResource(loadContestEvents);
  const contests = useResource(loadStaffContests);
  const problemSetMode = params.get("kind") === "problem_set";
  const available =
    events.data?.filter(
      (event) =>
        event.type === "contest" &&
        !contests.data?.contests.some(
          (contest) => contest.eventId === event.id,
        ),
    ) ?? [];
  const existing = contests.data?.contests.find(
    (contest) => contest.eventId === params.get("eventId"),
  );
  if (problemSetMode)
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="link" className="px-0">
          <Link href="/dashboard/contests">← All contests</Link>
        </Button>
        <PageHeading
          title="Create a practice problem set"
          description="Start with a draft. Add problems and test cases before publishing it to all signed-in students."
        />
        <Section title="Problem set details">
          <ProblemSetSettings onSaved={(id) => router.push(contestHref(id))} />
        </Section>
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="link" className="px-0">
        <Link href="/dashboard/contests">← All contests</Link>
      </Button>
      <PageHeading
        title="Create a programming contest"
        description="Start with a draft. Add problems and test cases before publishing it to accepted participants."
      />
      <ResourceContent resource={events}>
        <ResourceContent resource={contests}>
          {existing ? (
            <Section
              title="Programming contest already created"
              description="This event already has a linked programming contest."
            >
              <Button asChild>
                <Link href={contestHref(existing.id)}>
                  Manage {existing.title}
                </Link>
              </Button>
            </Section>
          ) : available.length ? (
            <Section title="Contest details">
              <ContestSettings
                key={params.get("eventId") ?? "new"}
                events={available}
                initialEventId={params.get("eventId") ?? ""}
                onSaved={(id) => router.push(contestHref(id))}
              />
            </Section>
          ) : (
            <EmptyState
              title="A contest event is required"
              description="Create an event with type Contest first. Each event can have one programming contest."
              href="/dashboard/events/create"
              action="Create event"
            />
          )}
        </ResourceContent>
      </ResourceContent>
    </div>
  );
}

export function StaffContestPage({ id }: { id: string }) {
  const load = useCallback(() => loadContestEditor(id), [id]);
  const resource = useResource(load);
  const [tab, setTab] = useState("problems");
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const events = useResource(loadContestEvents);
  const now = useContestClock();
  const data = resource.data;
  const locked =
    !!data &&
    !data.practice &&
    !!data.contest.startsAt &&
    now >= Date.parse(String(data.contest.startsAt));
  return (
    <div className="space-y-6">
      <Button asChild variant="link" className="px-0">
        <Link href="/dashboard/contests">← All contests</Link>
      </Button>
      <ResourceContent resource={resource}>
        {data && (
          <>
            <PageHeading
              title={data.contest.title}
              description={
                data.practice
                  ? "Practice problem set · open to all signed-in students"
                  : data.contest.startsAt && data.contest.endsAt
                    ? `${formatDateTime(data.contest.startsAt)} – ${formatDateTime(data.contest.endsAt)}`
                    : "No schedule"
              }
              action={
                <StatusBadge
                  status={data.contest.isActive ? "published" : "draft"}
                />
              }
            />
            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
              <TabsList className="">
                <TabsTrigger value="problems">Problems</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="publish">Publication</TabsTrigger>
              </TabsList>
              <TabsContent value="problems">
                <ContestProblems
                  contest={data.contest}
                  problems={data.problems}
                  locked={locked}
                  practice={data.practice}
                  selectedId={selectedProblem}
                  onSelect={setSelectedProblem}
                  onChange={resource.retry}
                />
              </TabsContent>
              <TabsContent value="settings">
                <Section
                  title={
                    data.practice ? "Problem set details" : "Contest details"
                  }
                  description={
                    data.practice
                      ? "Title, slug, languages, and practice content. Changes are available immediately."
                      : "Schedule, event, languages, and problem content lock when the contest starts."
                  }
                >
                  {data.practice ? (
                    <ProblemSetSettings
                      key={JSON.stringify(data.contest)}
                      contest={data.contest}
                      onSaved={resource.retry}
                    />
                  ) : (
                    <ResourceContent resource={events}>
                      {events.data && (
                        <ContestSettings
                          key={JSON.stringify(data.contest)}
                          contest={data.contest}
                          events={events.data.filter(
                            (event) => event.type === "contest",
                          )}
                          locked={locked}
                          onSaved={resource.retry}
                        />
                      )}
                    </ResourceContent>
                  )}
                </Section>
              </TabsContent>
              <TabsContent value="publish">
                <ContestPublication data={data} onChange={resource.retry} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </ResourceContent>
    </div>
  );
}

type SettingsProps = {
  contest?: StaffContest;
  events: Awaited<ReturnType<typeof loadContestEvents>>;
  initialEventId?: string;
  locked?: boolean;
  onSaved: (id: string) => void;
};

function ContestSettings({
  contest,
  events,
  initialEventId,
  locked = false,
  onSaved,
}: SettingsProps) {
  const prefix = useId();
  const languages = useResource(loadContestLanguages);
  const [eventId, setEventId] = useState(
    contest?.eventId ??
      (events.some((event) => event.id === initialEventId)
        ? initialEventId!
        : ""),
  );
  const event = events.find((event) => event.id === eventId);
  const [restricted, setRestricted] = useState(
    Boolean(contest?.allowedLanguages),
  );
  const [selected, setSelected] = useState(contest?.allowedLanguages ?? []);
  const [languageSearch, setLanguageSearch] = useState("");
  const [passwordMode, setPasswordMode] = useState(
    contest?.hasPassword ? "keep" : "none",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      const details = {
        title: String(values.get("title") ?? ""),
        slug: String(values.get("slug") ?? ""),
        description: String(values.get("description") ?? ""),
        ...(passwordMode === "replace"
          ? { password: String(values.get("password") ?? "") }
          : passwordMode === "none"
            ? { password: null }
            : {}),
        ...(!locked
          ? {
              eventId,
              startsAt: fromDateInput(String(values.get("startsAt"))),
              endsAt: fromDateInput(String(values.get("endsAt"))),
              allowedLanguages: restricted ? selected : null,
            }
          : {}),
      };
      if (!locked && Date.parse(details.startsAt!) <= Date.now())
        throw new Error(
          "Choose a future start time so you can prepare the problems.",
        );
      if (contest) {
        const parsed = updateContestSchema.parse(details);
        await readResponse(
          await client.contests[":id"].$put({
            param: { id: contest.id },
            json: parsed,
          }),
        );
        toast.success("Contest settings saved.");
        onSaved(contest.id);
      } else {
        const parsed = createContestSchema.parse({
          ...details,
          isActive: false,
        });
        const result = await readResponse(
          await client.contests.$post({ json: parsed }),
        );
        toast.success("Contest draft created.");
        onSaved(result.id);
      }
    } catch (cause) {
      // Zod's structured issues are more readable than its JSON Error.message.
      setError(
        cause &&
          typeof cause === "object" &&
          "issues" in cause &&
          Array.isArray(cause.issues)
          ? cause.issues
              .map((issue: { message: string }) => issue.message)
              .join(". ")
          : errorMessage(cause),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-5 sm:grid-cols-2"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-event`}>Linked event</Label>
          <Select
            value={eventId}
            onValueChange={setEventId}
            disabled={locked || pending}
            required
          >
            <SelectTrigger id={`${prefix}-event`} className="h-11 w-full">
              <SelectValue placeholder="Select a contest event" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {event && (
            <p className="text-xs text-muted-foreground">
              {event.teamBased ? "Team" : "Individual"} registration ·{" "}
              {formatDateTime(event.startsAt)}. Registration and approvals are
              managed on the event page.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-title`}>Contest title</Label>
          <Input
            id={`${prefix}-title`}
            name="title"
            required
            defaultValue={contest?.title}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-slug`}>URL slug</Label>
          <Input
            id={`${prefix}-slug`}
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="university-programming-contest"
            defaultValue={contest?.slug}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-description`}>Description</Label>
          <Textarea
            id={`${prefix}-description`}
            name="description"
            defaultValue={contest?.description ?? ""}
            className="min-h-28"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-start`}>Starts</Label>
          <Input
            key={`start-${eventId}`}
            id={`${prefix}-start`}
            name="startsAt"
            type="datetime-local"
            required
            disabled={locked}
            defaultValue={toDateInput(
              contest?.startsAt ?? event?.startsAt ?? null,
            )}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-end`}>Ends</Label>
          <Input
            key={`end-${eventId}`}
            id={`${prefix}-end`}
            name="endsAt"
            type="datetime-local"
            required
            disabled={locked}
            defaultValue={toDateInput(contest?.endsAt ?? event?.endsAt ?? null)}
            className="h-11"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Bangladesh time (UTC+06:00). All problems and test cases must be ready
          before the start time.
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-password-mode`}>Contest password</Label>
          <Select
            value={passwordMode}
            onValueChange={setPasswordMode}
            disabled={pending}
          >
            <SelectTrigger
              id={`${prefix}-password-mode`}
              className="h-11 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contest?.hasPassword && (
                <SelectItem value="keep">Keep current password</SelectItem>
              )}
              <SelectItem value="none">No password</SelectItem>
              <SelectItem value="replace">
                {contest?.hasPassword ? "Replace password" : "Set a password"}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Accepted registration is always required.
          </p>
        </div>
        {passwordMode === "replace" && (
          <div className="space-y-2">
            <Label htmlFor={`${prefix}-password`}>New password</Label>
            <Input
              id={`${prefix}-password`}
              name="password"
              type="password"
              required
              maxLength={72}
              autoComplete="new-password"
              className="h-11"
            />
          </div>
        )}
        <div className="space-y-3 sm:col-span-2">
          <Label htmlFor={`${prefix}-languages`}>Allowed languages</Label>
          <Select
            value={restricted ? "restricted" : "all"}
            onValueChange={(value) => setRestricted(value === "restricted")}
            disabled={locked || pending}
          >
            <SelectTrigger id={`${prefix}-languages`} className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All supported judge languages</SelectItem>
              <SelectItem value="restricted">
                Choose specific languages
              </SelectItem>
            </SelectContent>
          </Select>
          {restricted && (
            <ResourceContent resource={languages}>
              <SearchInput
                aria-label="Search programming languages"
                placeholder="Search languages"
                value={languageSearch}
                onChange={(event) => setLanguageSearch(event.target.value)}
              />
              <div className="grid max-h-64 gap-3 overflow-y-auto rounded-lg border p-4 sm:grid-cols-2">
                {languages.data
                  ?.filter((language) =>
                    language.name
                      .toLowerCase()
                      .includes(languageSearch.toLowerCase()),
                  )
                  .map((language) => (
                    <label
                      key={language.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        disabled={locked}
                        checked={selected.includes(language.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, language.id]
                              : ids.filter((id) => id !== language.id),
                          )
                        }
                      />
                      {language.name}
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.length} selected. Select at least one language.
              </p>
            </ResourceContent>
          )}
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="text-sm whitespace-pre-line text-destructive"
        >
          {error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Saving…" : contest ? "Save settings" : "Create draft"}
      </Button>
    </form>
  );
}

function ProblemSetSettings({
  contest,
  onSaved,
}: {
  contest?: StaffContest;
  onSaved: (id: string) => void;
}) {
  const prefix = useId();
  const languages = useResource(loadContestLanguages);
  const [restricted, setRestricted] = useState(
    Boolean(contest?.allowedLanguages),
  );
  const [selected, setSelected] = useState(contest?.allowedLanguages ?? []);
  const [languageSearch, setLanguageSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      const details = {
        title: String(values.get("title") ?? ""),
        slug: String(values.get("slug") ?? ""),
        description: String(values.get("description") ?? ""),
        allowedLanguages: restricted ? selected : null,
      };
      if (contest) {
        const parsed = updateProblemSetSchema.parse(details);
        await readResponse(
          await client.practice[":id"].$put({
            param: { id: contest.id },
            json: parsed,
          }),
        );
        toast.success("Problem set settings saved.");
      } else {
        const parsed = createProblemSetSchema.parse({
          ...details,
          isActive: false,
        });
        const result = await readResponse(
          await client.practice.$post({ json: parsed }),
        );
        toast.success("Problem set draft created.");
        onSaved(result.id);
        return;
      }
      onSaved(contest.id);
    } catch (cause) {
      setError(
        cause &&
          typeof cause === "object" &&
          "issues" in cause &&
          Array.isArray(cause.issues)
          ? cause.issues
              .map((issue: { message: string }) => issue.message)
              .join(". ")
          : errorMessage(cause),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-5 sm:grid-cols-2"
      >
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-title`}>Problem set title</Label>
          <Input
            id={`${prefix}-title`}
            name="title"
            required
            defaultValue={contest?.title}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-slug`}>URL slug</Label>
          <Input
            id={`${prefix}-slug`}
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="graph-practice-set"
            defaultValue={contest?.slug}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-description`}>Description</Label>
          <Textarea
            id={`${prefix}-description`}
            name="description"
            defaultValue={contest?.description ?? ""}
            className="min-h-28"
          />
        </div>
        <div className="space-y-3 sm:col-span-2">
          <Label htmlFor={`${prefix}-languages`}>Allowed languages</Label>
          <Select
            value={restricted ? "restricted" : "all"}
            onValueChange={(value) => setRestricted(value === "restricted")}
            disabled={pending}
          >
            <SelectTrigger id={`${prefix}-languages`} className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All supported judge languages</SelectItem>
              <SelectItem value="restricted">
                Choose specific languages
              </SelectItem>
            </SelectContent>
          </Select>
          {restricted && (
            <ResourceContent resource={languages}>
              <SearchInput
                aria-label="Search programming languages"
                placeholder="Search languages"
                value={languageSearch}
                onChange={(event) => setLanguageSearch(event.target.value)}
              />
              <div className="grid max-h-64 gap-3 overflow-y-auto rounded-lg border p-4 sm:grid-cols-2">
                {languages.data
                  ?.filter((language) =>
                    language.name
                      .toLowerCase()
                      .includes(languageSearch.toLowerCase()),
                  )
                  .map((language) => (
                    <label
                      key={language.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        disabled={pending}
                        checked={selected.includes(language.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, language.id]
                              : ids.filter((id) => id !== language.id),
                          )
                        }
                      />
                      {language.name}
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.length} selected. Select at least one language.
              </p>
            </ResourceContent>
          )}
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="text-sm whitespace-pre-line text-destructive"
        >
          {error}
        </p>
      )}
      <Button disabled={pending}>
        {pending
          ? "Saving…"
          : contest
            ? "Save problem set"
            : "Create problem set"}
      </Button>
    </form>
  );
}

function ContestPublication({
  data,
  onChange,
}: {
  data: ContestEditor;
  onChange: () => void;
}) {
  if (!data.event)
    return <ProblemSetPublication data={data} onChange={onChange} />;
  const { contest, event, problems } = data;
  const ready =
    problems.length > 0 &&
    problems.every((problem) => problem.testCases.length > 0);
  const samplesMissing = problems.filter(
    (problem) => !problem.testCases.some((testCase) => testCase.isSample),
  );
  const hiddenMissing = problems.filter(
    (problem) => !problem.testCases.some((testCase) => !testCase.isSample),
  );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Section
        title="Publication"
        description="Published contests appear for accepted participants. Problems unlock at the scheduled start time."
      >
        <div className="space-y-5">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Problems</dt>
              <dd>{problems.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Test cases</dt>
              <dd>
                {problems.reduce(
                  (count, problem) => count + problem.testCases.length,
                  0,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Registration</dt>
              <dd>{event.teamBased ? "Team" : "Individual"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Access</dt>
              <dd>
                {contest.hasPassword
                  ? "Password required"
                  : "Accepted participants"}
              </dd>
            </div>
          </dl>
          {!ready && (
            <p
              role="status"
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              Add at least one problem and at least one test case to every
              problem before publishing.
            </p>
          )}
          {ready && (samplesMissing.length > 0 || hiddenMissing.length > 0) && (
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Recommended before publishing:{" "}
              {samplesMissing.length > 0
                ? `add sample cases to ${samplesMissing.map((p) => p.title).join(", ")}. `
                : ""}
              {hiddenMissing.length > 0
                ? `Add hidden cases to ${hiddenMissing.map((p) => p.title).join(", ")}.`
                : ""}
            </p>
          )}
          <MutationButton
            variant={contest.isActive ? "outline" : "default"}
            disabled={!contest.isActive && !ready}
            action={async () =>
              readResponse(
                await client.contests[":id"].$put({
                  param: { id: contest.id },
                  json: { isActive: !contest.isActive },
                }),
              )
            }
            onSuccess={onChange}
            successMessage={
              contest.isActive ? "Contest unpublished." : "Contest published."
            }
          >
            {contest.isActive ? "Unpublish contest" : "Publish contest"}
          </MutationButton>
          <p className="text-xs break-all text-muted-foreground">
            Participant path: /contests/{contest.slug}
          </p>
        </div>
      </Section>
      <Section
        title="Linked event"
        description="Registration, team settings, and participant approvals are managed here."
      >
        <div className="space-y-4">
          <p className="font-medium break-words">{event.title}</p>
          <StatusBadge status={event.isActive ? "published" : "unpublished"} />
          <Button asChild variant="outline" className="w-full">
            <Link href={`/dashboard/events/${event.id}`}>
              Manage event & registrations
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            ICPC standings use a 20-minute penalty. Compilation errors do not
            add a penalty.
          </p>
        </div>
      </Section>
    </div>
  );
}

function ProblemSetPublication({
  data,
  onChange,
}: {
  data: ContestEditor;
  onChange: () => void;
}) {
  const { contest, problems } = data;
  const ready =
    problems.length > 0 &&
    problems.every((problem) => problem.testCases.length > 0);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Section
        title="Publication"
        description="Published problem sets appear on the Practice page for every signed-in student."
      >
        <div className="space-y-5">
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Problems</dt>
              <dd>{problems.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Test cases</dt>
              <dd>
                {problems.reduce(
                  (count, problem) => count + problem.testCases.length,
                  0,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Access</dt>
              <dd>All signed-in students</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Scoring</dt>
              <dd>Solved progress only</dd>
            </div>
          </dl>
          {!ready && (
            <p
              role="status"
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              Add at least one problem and at least one test case to every
              problem before publishing.
            </p>
          )}
          <MutationButton
            variant={contest.isActive ? "outline" : "default"}
            disabled={!contest.isActive && !ready}
            action={async () =>
              readResponse(
                await client.practice[":id"].$put({
                  param: { id: contest.id },
                  json: { isActive: !contest.isActive },
                }),
              )
            }
            onSuccess={onChange}
            successMessage={
              contest.isActive
                ? "Problem set unpublished."
                : "Problem set published."
            }
          >
            {contest.isActive ? "Unpublish problem set" : "Publish problem set"}
          </MutationButton>
          <p className="text-xs break-all text-muted-foreground">
            Student path: /practice/{contest.slug}
          </p>
        </div>
      </Section>
      <Section
        title="Practice access"
        description="No event registration or password is needed."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Students solve these problems at their own pace. Their solved
            progress is tracked individually and does not create ICPC standings.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/dashboard/contests`}>Manage all contests</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}
