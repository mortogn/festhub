"use client";

import { AuthUser, useAuthContext } from "@/context/auth-user-context";
import client from "@/lib/api";
import { InferResponseType } from "hono";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
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
  const loadStudent = useCallback(
    async () =>
      readResponse<StudentProfile>(
        await client.students[":id"].$get({ param: { id: user.id } }),
        refreshUser,
      ),
    [user.id, refreshUser],
  );
  const loadTeams = useCallback(
    async () =>
      readResponse<StudentTeams>(await client.teams.$get(), refreshUser),
    [refreshUser],
  );
  const loadInvites = useCallback(
    async () =>
      readResponse<TeamInvites>(
        await client["team-invites"].$get(),
        refreshUser,
      ),
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
