import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffVolunteersPage } from "@festhub/frontend/staff-volunteers";

export const metadata = { title: "Volunteers" };
export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <StaffVolunteersPage />
    </StaffPageGuard>
  );
}
