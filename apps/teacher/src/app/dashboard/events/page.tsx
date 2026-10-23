import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffEventsPage } from "@festhub/frontend/staff-events";

export const metadata = { title: "Events" };
export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <StaffEventsPage />
    </StaffPageGuard>
  );
}
