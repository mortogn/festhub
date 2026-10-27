"use client";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@festhub/frontend/api";

const always = () => true;
export function usePoll<T>(
  load: () => Promise<T>,
  interval: number | ((data: T) => number) = 0,
  shouldPoll: (data: T) => boolean = always,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    source: typeof load;
    data: T | null;
    error: string | null;
  }>({ source: load, data: null, error: null });
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    let busy = false;
    let polling = true;
    let delay = typeof interval === "number" ? interval : 10000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      if (!active || busy) return;
      busy = true;
      try {
        const data = await load();
        if (active) {
          setState({ source: load, data, error: null });
          polling = shouldPoll(data);
          delay = typeof interval === "number" ? interval : interval(data);
        }
      } catch (error) {
        if (active)
          setState((previous) => ({
            source: load,
            data: previous.source === load ? previous.data : null,
            error: errorMessage(error),
          }));
      } finally {
        busy = false;
        if (active && delay && polling)
          timer = setTimeout(() => {
            if (document.visibilityState === "visible") void tick();
          }, delay);
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible" && polling) {
        clearTimeout(timer);
        void tick();
      }
    };
    void tick();
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, interval, shouldPoll, attempt]);
  return {
    data: state.source === load ? state.data : null,
    error: state.source === load ? state.error : null,
    refresh,
  };
}

export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
