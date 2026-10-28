import { PracticeWorkspace } from "@/components/practice-workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PracticeWorkspace slug={slug} />;
}
