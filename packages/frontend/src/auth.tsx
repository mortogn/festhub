"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { InferResponseType } from "hono";
import { useRouter } from "next/navigation";
import { Button } from "@festhub/ui/components/button";
import client from "./api";
import { toast } from "@festhub/ui/components/sonner";
import { useToastFeedback } from "./notifications";

export type AuthUser = InferResponseType<typeof client.users.self.$get, 200>;
type State = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
};
type Auth = State & { retry: () => void; signOut: () => Promise<void> };
const Context = createContext<Auth | null>(null);
export default function AuthProvider({ children }: PropsWithChildren) {
  const toastFeedback = useToastFeedback();
  const [state, setState] = useState<State>({
    user: null,
    status: "loading",
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const retry = useCallback(() => {
    generation.current++;
    setState({ user: null, status: "loading", error: null });
    setAttempt((n) => n + 1);
  }, []);
  const signOut = useCallback(async () => {
    generation.current++;
    const response = await client.auth["sign-out"].$post();
    if (!response.ok) throw new Error("Unable to sign out. Please try again.");
    generation.current++;
    setState({ user: null, status: "unauthenticated", error: null });
  }, []);
  useEffect(() => {
    let active = true;
    const requestGeneration = ++generation.current;
    client.users.self
      .$get()
      .then(async (response) => {
        if (!active || requestGeneration !== generation.current) return;
        if (response.status === 401) {
          setState({ user: null, status: "unauthenticated", error: null });
          return;
        }
        if (!response.ok)
          throw new Error("Unable to load your account. Please try again.");
        const user = await response.json();
        if (active && requestGeneration === generation.current)
          setState({ user, status: "authenticated", error: null });
      })
      .catch(() => {
        if (active && requestGeneration === generation.current) {
          if (toastFeedback)
            toast.error("Unable to load your account. Please try again.");
          setState({
            user: null,
            status: "error",
            error: "Unable to load your account. Please try again.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, toastFeedback]);
  useEffect(() => {
    const expire = () => {
      generation.current++;
      setState({ user: null, status: "unauthenticated", error: null });
    };
    const focus = () => {
      generation.current++;
      setAttempt((n) => n + 1);
    };
    window.addEventListener("festhub:session-expired", expire);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("festhub:session-expired", expire);
      window.removeEventListener("focus", focus);
    };
  }, []);
  return (
    <Context.Provider value={{ ...state, retry, signOut }}>
      {children}
    </Context.Provider>
  );
}
export function useAuthContext() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
export function SignOutButton() {
  const toastFeedback = useToastFeedback();
  const { signOut } = useAuthContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await signOut();
            router.replace("/sign-in");
            router.refresh();
          } catch {
            if (toastFeedback)
              toast.error("Unable to sign out. Please try again.");
            else setError("Unable to sign out. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
