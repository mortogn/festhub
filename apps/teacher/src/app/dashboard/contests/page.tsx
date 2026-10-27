import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffContestsPage } from "@festhub/frontend/staff-contests";

export const metadata = { title: "Programming contests" };
export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <StaffContestsPage />
    </StaffPageGuard>
  );
}
