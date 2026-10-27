import { Badge } from "@festhub/ui/components/badge";
import { cn } from "@festhub/ui/lib/utils";

export type ContestPhase = "upcoming" | "live" | "finished";

export const contestPhase = (
  starts: number,
  ends: number,
  now: number,
): ContestPhase => (now < starts ? "upcoming" : now >= ends ? "finished" : "live");

const phaseStyles: Record<
  ContestPhase,
  { label: string; badge: string; dot: string }
> = {
  live: {
    label: "Ongoing",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  upcoming: {
    label: "Upcoming",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  finished: {
    label: "Finished",
    badge: "bg-muted text-muted-foreground ring-foreground/10",
    dot: "bg-muted-foreground/60",
  },
};

export function PhaseBadge({
  phase,
  className,
}: {
  phase: ContestPhase;
  className?: string;
}) {
  const style = phaseStyles[phase];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1.5 border-transparent px-2 ring-1 ring-inset",
        style.badge,
        className,
      )}
    >
      <span
        className={cn("relative inline-flex size-1.5 rounded-full", style.dot)}
      />
      {style.label}
    </Badge>
  );
}

export function LoadingBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
