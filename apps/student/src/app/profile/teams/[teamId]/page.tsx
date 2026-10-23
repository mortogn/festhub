import { Suspense } from "react";
import TeamDetails from "./team-details";

async function Content({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <TeamDetails teamId={teamId} />;
}
export default function Page({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  return (
    <Suspense fallback="Loading team…">
      <Content params={params} />
    </Suspense>
  );
}
