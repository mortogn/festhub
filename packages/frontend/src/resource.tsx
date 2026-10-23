"use client";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "./api";
import { toast } from "@festhub/ui/components/sonner";
import { useToastFeedback } from "./notifications";

export type Resource<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};
export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const toastFeedback = useToastFeedback();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    Omit<Resource<T>, "retry"> & { source: typeof load; attempt: number }
  >({ source: load, attempt: 0, data: null, isLoading: true, error: null });
  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active)
          setState({
            source: load,
            attempt,
            data,
            isLoading: false,
            error: null,
          });
      },
      (error: unknown) => {
        if (active) {
          if (toastFeedback) toast.error(errorMessage(error));
          setState({
            source: load,
            attempt,
            data: null,
            isLoading: false,
            error: errorMessage(error),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt, toastFeedback]);
  if (state.source !== load || state.attempt !== attempt)
    return { data: null, isLoading: true, error: null, retry };
  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    retry,
  };
}
