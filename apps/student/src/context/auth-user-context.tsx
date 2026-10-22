"use client";

import client from "@/lib/api";
import { InferResponseType } from "hono";
import React, {
  createContext,
  useEffect,
  useState,
  PropsWithChildren,
  useContext,
  useCallback,
} from "react";

export type AuthUser = InferResponseType<
  (typeof client)["users"]["self"]["$get"],
  200
>;

type AuthState = {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
};

export const AuthUserContext = createContext<
  (AuthState & { retry: () => void }) | undefined
>(undefined);

const AuthUserContextProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    status: "loading",
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ user: null, status: "loading", error: null });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await client.users.self.$get();
        if (!active) return;

        if (response.status === 401) {
          setState({ user: null, status: "unauthenticated", error: null });
          return;
        }

        if (!response.ok) throw new Error("Unable to load your account.");
        const user = await response.json();

        if (active) setState({ user, status: "authenticated", error: null });
      } catch {
        if (active) {
          setState({
            user: null,
            status: "error",
            error: "Unable to load your account. Please try again.",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <AuthUserContext.Provider value={{ ...state, retry }}>
      {children}
    </AuthUserContext.Provider>
  );
};

export const useAuthContext = () => {
  const authUser = useContext(AuthUserContext);
  if (!authUser) throw new Error("AuthUserContextProvider is required");
  return authUser;
};

export default AuthUserContextProvider;
