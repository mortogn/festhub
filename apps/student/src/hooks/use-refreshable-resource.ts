"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@festhub/frontend/api";
import type { Resource } from "@festhub/frontend/resource";

// Unlike the page-level resource hook, background refreshes keep the last result.
export function useRefreshableResource<T>(
  load: ((signal: AbortSignal) => Promise<T>) | null,
): Resource<T> & { refresh: () => void } {
  const [state, setState] = useState<Omit<Resource<T>, "retry">>({
    data: null,
    isLoading: load !== null,
    error: null,
  });
  const request = useRef<(afterCurrent: boolean) => void>(() => {});
  const retry = useCallback(() => request.current(true), []);
  const refresh = useCallback(() => request.current(false), []);

  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    let pending = false;
    let queued = false;

    const run = async (afterCurrent: boolean) => {
      if (pending) {
        // A mutation may complete while an older GET is still in flight.
        queued ||= afterCurrent;
        return;
      }
      pending = true;
      setState((previous) => ({
        ...previous,
        isLoading: previous.data === null,
        error: null,
      }));
      try {
        const data = await load(controller.signal);
        if (!controller.signal.aborted)
          setState({ data, isLoading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            isLoading: false,
            error: errorMessage(error),
          }));
      } finally {
        pending = false;
        if (queued && !controller.signal.aborted) {
          queued = false;
          void run(false);
        }
      }
    };

    request.current = (afterCurrent) => {
      void run(afterCurrent);
    };
    void run(false);
    return () => {
      controller.abort();
      request.current = () => {};
    };
  }, [load]);

  return { ...state, retry, refresh };
}
