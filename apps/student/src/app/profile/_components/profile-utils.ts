import type { StudentTeams } from "./profile-data";

export function getTeamMembers(teammates: StudentTeams[number]["teammates"]) {
  return teammates.filter((member) =>
    Object.values(member).some((value) => value !== null && value !== ""),
  );
}

export function getTeamStatus(team: StudentTeams[number]["team"]) {
  return team.registeredAt === null ? "draft" : team.status;
}

export function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "S"
  );
}
