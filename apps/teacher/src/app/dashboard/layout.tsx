import { StaffShell } from "@festhub/frontend/staff-shell";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <StaffShell role="teacher">{children}</StaffShell>;
}
