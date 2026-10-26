import { Suspense } from "react";
import { StaffAttendancePage } from "@festhub/frontend/staff-attendance";
import { StaffPageGuard } from "@festhub/frontend/staff-shell";

export const metadata = { title: "Scan students" };
type Props = { params: Promise<{ id: string }> };

async function Content({ params }: Props) {
  const { id } = await params;
  return <StaffAttendancePage key={id} id={id} />;
}

export default function Page(props: Props) {
  return (
    <StaffPageGuard role="teacher">
      <Suspense fallback="Loading…">
        <Content {...props} />
      </Suspense>
    </StaffPageGuard>
  );
}
