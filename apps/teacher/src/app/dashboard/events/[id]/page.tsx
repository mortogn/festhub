import { Suspense } from "react";
import { StaffEventPage } from "@festhub/frontend/staff-events";

export const metadata = { title: "Event" };
type Props = { params: Promise<{ id: string }> };
async function Content({ params }: Props) {
  const { id } = await params;
  return <StaffEventPage id={id} />;
}
export default function Page(props: Props) {
  return (
    <Suspense fallback="Loading…">
      <Content {...props} />
    </Suspense>
  );
}
