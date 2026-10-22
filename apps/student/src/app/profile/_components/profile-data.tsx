"use client";

import { AuthUser, useAuthContext } from "@/context/auth-user-context";
import client from "@/lib/api";
import { InferResponseType } from "hono";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type StudentProfile = InferResponseType<
  (typeof client.students)[":id"]["$get"],
  200
>;
export type StudentTeams = InferResponseType<typeof client.teams.$get, 200>;
export type TeamInvites = InferResponseType<
  (typeof client)["team-invites"]["$get"],
  200
>;

export type Resource<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

export function useResource<T>(load: () => Promise<T>): Resource<T> {
  const [state, setState] = useState<Omit<Resource<T>, "retry">>({
    data: null,
    isLoading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ data: null, isLoading: true, error: null });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ data, isLoading: false, error: null });
      },
      () => {
        if (active)
          setState({
            data: null,
            isLoading: false,
            error: "Unable to load this information. Please try again.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt]);

  return { ...state, retry };
}

async function readResponse<T>(
  response: Response,
  refreshUser: () => void,
): Promise<T> {
  if (response.status === 401) refreshUser();
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

type ProfileData = {
  user: AuthUser;
  student: Resource<StudentProfile>;
  teams: Resource<StudentTeams>;
  invites: Resource<TeamInvites>;
};

const ProfileContext = createContext<ProfileData | null>(null);

export function ProfileDataProvider({
  user,
  children,
}: PropsWithChildren<{ user: AuthUser }>) {
  const { retry: refreshUser } = useAuthContext();
  const loadStudent = useCallback(
    async () =>
      readResponse<StudentProfile>(
        await client.students[":id"].$get({ param: { id: user.id } }),
        refreshUser,
      ),
    [user.id, refreshUser],
  );
  const loadTeams = useCallback(
    async () => readResponse<StudentTeams>(await client.teams.$get(), refreshUser),
    [refreshUser],
  );
  const loadInvites = useCallback(
    async () => readResponse<TeamInvites>(await client["team-invites"].$get(), refreshUser),
    [refreshUser],
  );
  const student = useResource(loadStudent);
  const teams = useResource(loadTeams);
  const invites = useResource(loadInvites);

  return (
    <ProfileContext.Provider value={{ user, student, teams, invites }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileData() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("ProfileDataProvider is required");
  return context;
}
