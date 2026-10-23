import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffOverview } from "@festhub/frontend/staff-events";

export const metadata = { title: "Overview" };
export default function Page() {
  return (
    <StaffPageGuard role="admin">
      <StaffOverview />
    </StaffPageGuard>
  );
}
