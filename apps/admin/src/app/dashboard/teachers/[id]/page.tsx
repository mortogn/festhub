import { Suspense } from "react";
import { StaffTeacherPage } from "@festhub/frontend/staff-directory";

export const metadata = { title: "Teacher" };
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  return <StaffTeacherPage id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback="Loading…">
      <Content {...props} />
    </Suspense>
  );
}
