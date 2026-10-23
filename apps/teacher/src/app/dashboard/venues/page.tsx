import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffVenuesPage } from "@festhub/frontend/staff-venues";

export const metadata = { title: "Venues" };
export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <StaffVenuesPage />
    </StaffPageGuard>
  );
}
