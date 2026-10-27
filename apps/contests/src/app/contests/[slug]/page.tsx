import { ContestWorkspace } from "@/components/contest-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ContestWorkspace slug={slug} />;
}
