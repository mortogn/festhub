"use client";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuthContext } from "@festhub/frontend/auth";
import {
  CheckCircle2Icon,
  ChevronUpIcon,
  CircleXIcon,
  LoaderCircleIcon,
  XIcon,
} from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import { loadPracticeSubmission, loadSubmission } from "@/lib/api";
import { VerdictBadge } from "./submissions";

type SubmissionStatus = "queued" | "processing" | "completed" | "error";
export type TrackedSubmission = {
  id: string;
  contestId: string;
  practice: boolean;
  href: string;
  contestTitle: string;
  problemLabel: string;
  problemTitle: string;
  submittedAt: number;
  status: SubmissionStatus;
  verdict: string | null;
};
type TrackerContext = {
  submissions: TrackedSubmission[];
  track: (
    submission: Omit<TrackedSubmission, "status" | "verdict" | "submittedAt">,
  ) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
};

const MAX_TRACKED = 50;
const POLL_INTERVAL = 2000;
const MAX_POLL_FAILURES = 5;
const Context = createContext<TrackerContext | null>(null);
const storageKey = (userId: string) => `festhub:tracked-submissions:${userId}`;
const isPending = (entry: Pick<TrackedSubmission, "status">) =>
  entry.status === "queued" || entry.status === "processing";
const isAccepted = (entry: TrackedSubmission) =>
  entry.status === "completed" && entry.verdict === "AC";

function readStored(userId: string): TrackedSubmission[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(userId)) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (entry): entry is TrackedSubmission =>
              !!entry &&
              typeof entry.id === "string" &&
              typeof entry.contestId === "string" &&
              typeof entry.href === "string" &&
              typeof entry.status === "string",
          )
          .slice(0, MAX_TRACKED)
      : [];
  } catch {
    return [];
  }
}

export function SubmissionTrackerProvider({ children }: PropsWithChildren) {
  const { user } = useAuthContext();
  const userId = user?.id;
  const [store, setStore] = useState<{
    owner: string | null;
    items: TrackedSubmission[];
  }>({ owner: null, items: [] });
  // Entries only belong to the user they were loaded for.
  const submissions = useMemo(
    () => (store.owner === (userId ?? null) ? store.items : []),
    [store, userId],
  );
  const setSubmissions = useCallback(
    (update: (previous: TrackedSubmission[]) => TrackedSubmission[]) =>
      setStore((previous) => ({ ...previous, items: update(previous.items) })),
    [],
  );
  const latest = useRef(submissions);
  useEffect(() => {
    latest.current = submissions;
  }, [submissions]);
  useEffect(() => {
    // Browser-only persistence is loaded after hydration, once the user is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore({ owner: userId ?? null, items: userId ? readStored(userId) : [] });
  }, [userId]);
  useEffect(() => {
    if (!userId || store.owner !== userId) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(store.items));
    } catch {
      // Tracking still works in memory without storage.
    }
  }, [store, userId]);

  const pendingKey = submissions
    .filter(isPending)
    .map((entry) => entry.id)
    .join(",");
  useEffect(() => {
    if (!pendingKey) return;
    let active = true;
    let busy = false;
    const failures = new Map<string, number>();
    async function tick() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const results = await Promise.all(
          latest.current.filter(isPending).map(async (entry) => {
            try {
              const detail = await (entry.practice
                ? loadPracticeSubmission
                : loadSubmission)(entry.contestId, entry.id);
              failures.delete(entry.id);
              return {
                id: entry.id,
                status: detail.status as SubmissionStatus,
                verdict: detail.verdict,
              };
            } catch {
              const count = (failures.get(entry.id) ?? 0) + 1;
              failures.set(entry.id, count);
              // Stop polling submissions that cannot be loaded (e.g. deleted).
              return count >= MAX_POLL_FAILURES
                ? { id: entry.id, status: "error" as const, verdict: null }
                : null;
            }
          }),
        );
        if (!active) return;
        const updates = new Map(
          results.flatMap((entry) => (entry ? [[entry.id, entry] as const] : [])),
        );
        if (updates.size)
          setSubmissions((previous) =>
            previous.map((entry) => {
              const update = updates.get(entry.id);
              return update
                ? { ...entry, status: update.status, verdict: update.verdict }
                : entry;
            }),
          );
      } finally {
        busy = false;
      }
    }
    const visible = () => void tick();
    void tick();
    const timer = setInterval(tick, POLL_INTERVAL);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pendingKey, setSubmissions]);

  const track = useCallback<TrackerContext["track"]>((submission) => {
    const entry: TrackedSubmission = {
      ...submission,
      submittedAt: Date.now(),
      status: "queued",
      verdict: null,
    };
    setSubmissions((previous) =>
      [entry, ...previous.filter((item) => item.id !== entry.id)].slice(
        0,
        MAX_TRACKED,
      ),
    );
  }, [setSubmissions]);
  const remove = useCallback(
    (id: string) =>
      setSubmissions((previous) => previous.filter((entry) => entry.id !== id)),
    [setSubmissions],
  );
  const clearFinished = useCallback(
    () => setSubmissions((previous) => previous.filter(isPending)),
    [setSubmissions],
  );
  const value = useMemo(
    () => ({ submissions, track, remove, clearFinished }),
    [submissions, track, remove, clearFinished],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <SubmissionTracker />
    </Context.Provider>
  );
}

export function useSubmissionTracker() {
  const context = useContext(Context);
  if (!context)
    throw new Error(
      "useSubmissionTracker must be used within SubmissionTrackerProvider",
    );
  return context;
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        className,
      )}
    >
      <span className="font-semibold">{value}</span>
      {label}
    </span>
  );
}

function SubmissionTracker() {
  const { submissions, remove, clearFinished } = useSubmissionTracker();
  const [open, setOpen] = useState(false);
  if (!submissions.length) return null;
  const total = submissions.length;
  const judging = submissions.filter(isPending).length;
  const accepted = submissions.filter(isAccepted).length;
  const rejected = total - judging - accepted;
  const segment = (count: number) => `${(count / total) * 100}%`;
  return (
    <section
      aria-label="Submission progress"
      className="fixed right-4 bottom-4 z-40 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-lg"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="submission-tracker-list"
        onClick={() => setOpen((value) => !value)}
        className="block w-full space-y-2.5 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {judging
              ? `Judging ${judging} of ${total} submission${total === 1 ? "" : "s"}`
              : "All submissions judged"}
          </span>
          <ChevronUpIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
        <span
          role="progressbar"
          aria-label="Submission progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={total - judging}
          aria-valuetext={`${total} submitted, ${judging} judging, ${accepted} accepted, ${rejected} rejected`}
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <span
            className="h-full bg-emerald-500 transition-[width]"
            style={{ width: segment(accepted) }}
          />
          <span
            className="h-full bg-red-500 transition-[width]"
            style={{ width: segment(rejected) }}
          />
          <span
            className="h-full animate-pulse bg-amber-400 transition-[width] motion-reduce:animate-none"
            style={{ width: segment(judging) }}
          />
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Stat label="submitted" value={total} className="bg-muted" />
          <Stat
            label="judging"
            value={judging}
            className="bg-amber-50 text-amber-700"
          />
          <Stat
            label="accepted"
            value={accepted}
            className="bg-emerald-50 text-emerald-700"
          />
          <Stat
            label="rejected"
            value={rejected}
            className="bg-red-50 text-red-700"
          />
        </span>
      </button>
      {open && (
        <div id="submission-tracker-list" className="border-t">
          <ul className="max-h-72 divide-y overflow-y-auto">
            {submissions.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 py-2 pr-2 pl-4"
              >
                {isPending(entry) ? (
                  <LoaderCircleIcon
                    aria-hidden
                    className="size-4 shrink-0 animate-spin text-amber-500 motion-reduce:animate-none"
                  />
                ) : isAccepted(entry) ? (
                  <CheckCircle2Icon
                    aria-hidden
                    className="size-4 shrink-0 text-emerald-600"
                  />
                ) : (
                  <CircleXIcon
                    aria-hidden
                    className="size-4 shrink-0 text-red-600"
                  />
                )}
                <Link
                  href={entry.href}
                  className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block truncate text-sm font-medium">
                    {entry.problemLabel}. {entry.problemTitle}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.practice ? "Practice · " : ""}
                    {entry.contestTitle}
                  </span>
                </Link>
                <VerdictBadge status={entry.status} verdict={entry.verdict} />
                <button
                  type="button"
                  aria-label={`Remove ${entry.problemLabel}. ${entry.problemTitle} from the list`}
                  onClick={() => remove(entry.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {judging < total && (
            <div className="border-t px-4 py-2 text-right">
              <button
                type="button"
                onClick={clearFinished}
                className="rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Clear finished
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
