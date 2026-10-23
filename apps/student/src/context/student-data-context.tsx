"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import type { InferResponseType } from "hono";
import { readResponse } from "@festhub/frontend/api";
import type { Resource } from "@festhub/frontend/resource";
import { useAuthContext } from "@/context/auth-user-context";
import { useRefreshableResource } from "@/hooks/use-refreshable-resource";
import client from "@/lib/api";

export type StudentProfile = InferResponseType<
  (typeof client.students)[":id"]["$get"],
  200
>;
export type TeamInvites = InferResponseType<
  (typeof client)["team-invites"]["$get"],
  200
>;

type StudentData = {
  student: Resource<StudentProfile>;
  invites: Resource<TeamInvites>;
  pendingTeams: TeamInvites;
  pendingVolunteering: StudentProfile["volunteerEvents"];
};
const Context = createContext<StudentData | null>(null);

function StudentSession({
  studentId,
  children,
}: PropsWithChildren<{ studentId: string | null }>) {
  // The root layout is prerendered; read the clock only after mounting.
  const [now, setNow] = useState(0);
  const loadStudent = useCallback(
    async (signal: AbortSignal) =>
      readResponse(
        await client.students[":id"].$get(
          { param: { id: studentId! } },
          { init: { signal } },
        ),
      ),
    [studentId],
  );
  const loadInvites = useCallback(
    async (signal: AbortSignal) =>
      readResponse(await client["team-invites"].$get({}, { init: { signal } })),
    [],
  );
  const student = useRefreshableResource(studentId ? loadStudent : null);
  const invites = useRefreshableResource(studentId ? loadInvites : null);
  const { refresh: refreshStudent } = student;
  const { refresh: refreshInvites } = invites;

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setNow(Date.now());
    });
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      refreshStudent();
      refreshInvites();
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [studentId, refreshStudent, refreshInvites]);

  const pendingTeams = (invites.data ?? []).filter(
    (invite) =>
      invite.status === "pending" &&
      new Date(invite.event.endsAt).getTime() > now,
  );
  const pendingVolunteering = (student.data?.volunteerEvents ?? []).filter(
    (event) =>
      event.volunteerType === "invited" &&
      event.volunteerStatus === "pending" &&
      new Date(event.endsAt).getTime() > now,
  );

  return (
    <Context.Provider
      value={{ student, invites, pendingTeams, pendingVolunteering }}
    >
      {children}
    </Context.Provider>
  );
}

export default function StudentDataProvider({ children }: PropsWithChildren) {
  const { user, status } = useAuthContext();
  const studentId =
    status === "authenticated" && user?.role === "student" ? user.id : null;
  return (
    <StudentSession key={studentId ?? "anonymous"} studentId={studentId}>
      {children}
    </StudentSession>
  );
}

export function useStudentData() {
  const value = useContext(Context);
  if (!value) throw new Error("StudentDataProvider is required");
  return value;
}
