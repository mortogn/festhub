"use client";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import { Badge } from "@festhub/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@festhub/ui/components/card";
import { loadContests } from "@/lib/api";
import { usePoll, useClock } from "@/lib/use-poll";
import { ErrorState } from "./shell";

export function ContestList() {
  const now = useClock();
  const { data, error, refresh } = usePoll(loadContests, 30000);
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          The contest arena
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next challenge.
        </h1>
        <p className="text-muted-foreground">
          Pick a contest, solve the problems, and climb the standings.
        </p>
      </div>
      {error && <ErrorState message={error} retry={refresh} />}
      {!data && !error && <p role="status">Loading contests…</p>}
      {data && !data.contests.length && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No contests yet. Contests appear here after your event registration
            is accepted.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {data?.contests.map((contest) => (
          <Card key={contest.id}>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {new Date(contest.startsAt).getTime() > now
                    ? "Upcoming"
                    : new Date(contest.endsAt).getTime() <= now
                      ? "Finished"
                      : "Live"}
                </Badge>
                {contest.hasPassword && (
                  <Badge variant="outline">Password required</Badge>
                )}
              </div>
              <CardTitle className="text-xl">{contest.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {new Date(contest.startsAt).toLocaleString()}
                <br />
                {Math.round(
                  (new Date(contest.endsAt).getTime() -
                    new Date(contest.startsAt).getTime()) /
                    60000,
                )}{" "}
                minutes
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href={`/contests/${contest.slug}`}>Open contest →</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
