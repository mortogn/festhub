"use client";

import { AuthUser, useAuthContext } from "@/context/auth-user-context";
import client from "@/lib/api";
import { InferResponseType } from "hono";
import {
  useStudentData,
  type StudentProfile,
  type TeamInvites,
} from "@/context/student-data-context";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
} from "react";

export type {
  StudentProfile,
  TeamInvites,
} from "@/context/student-data-context";
export type StudentTeams = InferResponseType<typeof client.teams.$get, 200>;

export { useResource, type Resource } from "@festhub/frontend/resource";
import { useResource, type Resource } from "@festhub/frontend/resource";

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
  const { student, invites } = useStudentData();
  const loadTeams = useCallback(
    async () =>
      readResponse<StudentTeams>(await client.teams.$get(), refreshUser),
    [refreshUser],
  );
  const teams = useResource(loadTeams);

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
