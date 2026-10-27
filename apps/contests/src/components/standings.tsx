"use client";
import { useCallback } from "react";
import {
  Card,
  CardContent,
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
import { loadStandings } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";
import { ErrorState } from "./shell";

export function StandingsTable({ contestId }: { contestId: string }) {
  const loader = useCallback(() => loadStandings(contestId), [contestId]);
  const { data, error, refresh } = usePoll(loader, 10000);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked by solves, then penalty. Wrong attempts before AC add 20
          minutes; compilation errors are excluded.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorState message={error} retry={refresh} />}
        {!data && !error && <p role="status">Loading standings…</p>}
        {data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>{data.teamBased ? "Team" : "Participant"}</TableHead>
                <TableHead>Solved</TableHead>
                <TableHead>Penalty</TableHead>
                {data.problems.map((problem) => (
                  <TableHead key={problem.id}>{problem.title}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.standings.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.rank}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.solved}</TableCell>
                  <TableCell>{row.penalty}</TableCell>
                  {data.problems.map((problem) => {
                    const result = row.problems[problem.id];
                    return (
                      <TableCell
                        key={problem.id}
                        className={
                          result?.solved
                            ? "font-medium text-emerald-700"
                            : result?.wrong
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
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
        )}
        {data && !data.standings.length && (
          <p className="text-muted-foreground">No accepted participants yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
