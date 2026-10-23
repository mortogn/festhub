import { StaffAuth } from "@festhub/frontend/staff-auth";

export const metadata = { title: "Create account" };
export default function SignUp() {
  return <StaffAuth role="teacher" signup />;
}
