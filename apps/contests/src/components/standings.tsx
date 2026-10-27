"use client";
import { useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@festhub/ui/components/table";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { TrophyIcon } from "@festhub/ui/icons";
import { cn } from "@festhub/ui/lib/utils";
import { loadStandings } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";
import { LoadingBlock } from "./status";

const podium: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 ring-amber-500/40",
  2: "bg-slate-100 text-slate-700 ring-slate-400/40",
  3: "bg-orange-100 text-orange-800 ring-orange-500/40",
};

export function StandingsTable({ contestId }: { contestId: string }) {
  const loader = useCallback(() => loadStandings(contestId), [contestId]);
  const { data, error, refresh } = usePoll(loader, 10000);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <TrophyIcon className="size-5 text-brand" />
          Standings
        </CardTitle>
        <CardDescription>
          Ranked by solves, then penalty. Wrong attempts before AC add 20
          minutes; compilation errors are excluded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && (
          <LoadingBlock label="Loading standings…">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </LoadingBlock>
        )}
        {data && (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>
                    {data.teamBased ? "Team" : "Participant"}
                  </TableHead>
                  <TableHead className="text-right">Solved</TableHead>
                  <TableHead className="text-right">Penalty</TableHead>
                  {data.problems.map((problem) => (
                    <TableHead key={problem.id} className="text-center">
                      {problem.title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.standings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums",
                          podium[row.rank]
                            ? `${podium[row.rank]} ring-1`
                            : "text-muted-foreground",
                        )}
                      >
                        {row.rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {row.solved}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                      {row.penalty}
                    </TableCell>
                    {data.problems.map((problem) => {
                      const result = row.problems[problem.id];
                      return (
                        <TableCell
                          key={problem.id}
                          className={cn(
                            "text-center font-mono text-xs tabular-nums",
                            result?.solved
                              ? "bg-emerald-50 font-semibold text-emerald-700"
                              : result?.wrong
                                ? "bg-destructive/5 text-destructive"
                                : "text-muted-foreground/60",
                          )}
                        >
                          {result?.solved
                            ? `+${result.wrong || ""} (${result.minutes}m)`
                            : result?.wrong
                              ? `−${result.wrong}`
                              : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && !data.standings.length && (
          <p className="py-4 text-center text-muted-foreground">
            No accepted participants yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
