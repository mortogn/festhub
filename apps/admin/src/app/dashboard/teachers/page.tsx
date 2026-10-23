import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffTeachersPage } from "@festhub/frontend/staff-directory";

export const metadata = { title: "Teachers" };
export default function Page() {
  return (
    <StaffPageGuard role="admin">
      <StaffTeachersPage />
    </StaffPageGuard>
  );
}
