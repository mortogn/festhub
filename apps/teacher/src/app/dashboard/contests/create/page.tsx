import { Suspense } from "react";
import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffCreateContestPage } from "@festhub/frontend/staff-contests";

export const metadata = { title: "Create programming contest" };
export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <Suspense fallback="Loading…">
        <StaffCreateContestPage />
      </Suspense>
    </StaffPageGuard>
  );
}
