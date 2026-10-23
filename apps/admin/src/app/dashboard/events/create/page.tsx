import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffCreateEventPage } from "@festhub/frontend/staff-events";

export const metadata = { title: "Create event" };
export default function Page() {
  return (
    <StaffPageGuard role="admin">
      <StaffCreateEventPage />
    </StaffPageGuard>
  );
}
