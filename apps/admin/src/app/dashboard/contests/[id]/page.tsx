import { Suspense } from "react";
import { StaffPageGuard } from "@festhub/frontend/staff-shell";
import { StaffContestPage } from "@festhub/frontend/staff-contests";

export const metadata = { title: "Manage programming contest" };
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  return <StaffContestPage id={id} />;
}
export default function Page(props: Props) {
  return (
    <StaffPageGuard role="admin">
      <Suspense fallback="Loading…">
        <Content {...props} />
      </Suspense>
    </StaffPageGuard>
  );
}
