"use client";
import { Button } from "@festhub/ui/components/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4 rounded-md border p-8">
      <h1 className="text-2xl font-bold">This page could not be loaded</h1>
      <p className="text-sm text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
