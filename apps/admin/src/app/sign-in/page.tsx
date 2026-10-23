import { StaffAuth } from "@festhub/frontend/staff-auth";

export const metadata = { title: "Sign in" };
export default function SignIn() {
  return <StaffAuth role="admin" />;
}
