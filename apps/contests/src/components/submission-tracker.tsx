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
import { ChevronUpIcon, LoaderCircleIcon, XIcon } from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import { loadPracticeSubmission, loadSubmission } from "@/lib/api";

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
    setStore({
      owner: userId ?? null,
      items: userId ? readStored(userId) : [],
    });
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
              const detail = await (
                entry.practice ? loadPracticeSubmission : loadSubmission
              )(entry.contestId, entry.id);
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
          results.flatMap((entry) =>
            entry ? [[entry.id, entry] as const] : [],
          ),
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

  const track = useCallback<TrackerContext["track"]>(
    (submission) => {
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
    },
    [setSubmissions],
  );
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

function RowStatus({ entry }: { entry: TrackedSubmission }) {
  if (isPending(entry))
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <LoaderCircleIcon
          aria-hidden
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
        Judging
      </span>
    );
  return (
    <span
      className={cn(
        "font-mono text-xs font-semibold",
        isAccepted(entry) ? "text-emerald-600" : "text-red-600",
      )}
    >
      {entry.status === "error" ? "ERR" : (entry.verdict ?? "WA")}
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
  const summary = [judging && "judging", accepted && "AC", rejected && "WA"]
    .filter(Boolean)
    .join(", ");
  return (
    <section
      aria-label="Submission progress"
      className="fixed right-6 bottom-6 z-40 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-card/95 text-card-foreground shadow-lg backdrop-blur font-mono"
    >
      {open && (
        <div id="submission-tracker-list" className="border-b">
          <ul className="max-h-64 overflow-y-auto py-1">
            {submissions.map((entry) => (
              <li
                key={entry.id}
                className="group flex items-center gap-2 py-1.5 pr-1.5 pl-3 hover:bg-muted/50"
              >
                <Link
                  href={entry.href}
                  className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block truncate text-[13px] font-medium">
                    {entry.problemLabel}. {entry.problemTitle}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {entry.practice ? "Practice · " : ""}
                    {entry.contestTitle}
                  </span>
                </Link>
                <RowStatus entry={entry} />
                <button
                  type="button"
                  aria-label={`Remove ${entry.problemLabel}. ${entry.problemTitle} from the list`}
                  onClick={() => remove(entry.id)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {judging < total && (
            <div className="border-t px-3 py-1.5 text-right">
              <button
                type="button"
                onClick={clearFinished}
                className="rounded-md text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Clear finished
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="submission-tracker-list"
        onClick={() => setOpen((value) => !value)}
        className="block w-full outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span className="flex items-center gap-2.5 px-6 pt-3 pb-2.5 text-xs">
          <span className="font-medium tracking-wide">Submissions</span>
          <span className="flex flex-1 items-center gap-2 font-semibold">
            {judging > 0 && (
              <span className="flex items-center gap-1 font-medium text-amber-600">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" />
                Judging
              </span>
            )}
            {accepted > 0 && <span className="text-green-600">AC</span>}
            {rejected > 0 && <span className="text-red-600">WA</span>}
          </span>
          <ChevronUpIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
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
          aria-valuetext={summary}
          className="flex h-0.5 w-full bg-muted"
        >
          <span
            className="h-full bg-green-500 transition-[width]"
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
      </button>
    </section>
  );
}
