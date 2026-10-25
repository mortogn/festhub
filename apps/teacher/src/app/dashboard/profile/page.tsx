import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffProfilePage } from "@festhub/frontend/profile";

export const metadata = { title: "My profile" };

export default function Page() {
  return (
    <StaffPageGuard role="teacher">
      <StaffProfilePage />
    </StaffPageGuard>
  );
}
