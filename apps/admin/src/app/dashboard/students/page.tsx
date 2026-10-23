import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffStudentsPage } from "@festhub/frontend/staff-directory";

export const metadata = { title: "Students" };
export default function Page() {
  return (
    <StaffPageGuard role="admin">
      <StaffStudentsPage />
    </StaffPageGuard>
  );
}
