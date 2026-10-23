"use client";

import {
  createContext,
  useCallback,
  useContext,
  type PropsWithChildren,
} from "react";
import { useAuthContext } from "@/context/auth-user-context";
import { useStudentData } from "@/context/student-data-context";
import client from "@/lib/api";
import { readResponse } from "@festhub/frontend/api";
import { useResource, type Resource } from "@festhub/frontend/resource";
import type {
  StudentProfile,
  StudentTeams,
} from "@/app/profile/_components/profile-data";

type Activity = {
  student: Resource<StudentProfile | null>;
  teams: Resource<StudentTeams>;
};
const Context = createContext<Activity | null>(null);
function ActivityLoader({ children }: PropsWithChildren) {
  const { user, status } = useAuthContext();
  const { student } = useStudentData();
  const loadTeams = useCallback(
    async () =>
      user?.role === "student" && status === "authenticated"
        ? readResponse(await client.teams.$get())
        : [],
    [user, status],
  );
  const teams = useResource(loadTeams);
  return (
    <Context.Provider value={{ student, teams }}>{children}</Context.Provider>
  );
}
export function EventActivityProvider({ children }: PropsWithChildren) {
  const { user } = useAuthContext();
  return (
    <ActivityLoader key={user?.id ?? "anonymous"}>{children}</ActivityLoader>
  );
}
export function useEventActivity() {
  const value = useContext(Context);
  if (!value) throw new Error("EventActivityProvider is required");
  return value;
}

export function VolunteerCardVisibility({
  eventId,
  publicSetting,
  children,
}: PropsWithChildren<{ eventId: string; publicSetting: boolean }>) {
  const { student } = useEventActivity();
  return publicSetting ||
    student.data?.volunteerEvents.some((event) => event.id === eventId)
    ? children
    : null;
}
