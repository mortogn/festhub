import { Skeleton } from "@festhub/ui/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading page">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
