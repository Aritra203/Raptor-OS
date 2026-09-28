"use client";

import * as React from "react";
import {
  Activity,
  RotateCcw,
  Loader2,
  Users,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface JudgingProgressCardProps {
  eventId: string;
}

interface ProgressData {
  overview: {
    totalAssignments: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
    completionRate: number;
    scoredSubmissionsCount: number;
    fullyEvaluatedCount: number;
    underEvaluatedCount: number;
  };
  judgeWorkload: Array<{
    judgeId: string;
    judgeName: string;
    judgeEmail: string;
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
  }>;
  submissionCoverage: Array<{
    submissionId: string;
    submissionTitle: string;
    teamName: string;
    totalAssigned: number;
    completedCount: number;
    isFullyEvaluated: boolean;
  }>;
}

export function JudgingProgressCard({ eventId }: JudgingProgressCardProps) {
  const [data, setData] = React.useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProgress = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/events/${eventId}/judging/progress`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load judging progress.");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive flex items-center justify-between">
        <span>{error || "No judging data available."}</span>
        <Button size="sm" variant="outline" onClick={fetchProgress} className="h-6 text-xs">
          Retry
        </Button>
      </div>
    );
  }

  const { overview, judgeWorkload, submissionCoverage } = data;

  return (
    <div className="space-y-6">
      {/* Real-time Overview Card */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Real-time Judging Progress</CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchProgress}
              disabled={isLoading}
              className="h-7 text-xs gap-1"
            >
              <RotateCcw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <CardDescription className="text-xs">
            Live completion telemetry across all assigned judges and project evaluations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-foreground">Overall Completion Rate</span>
              <span className="font-bold text-emerald-400 font-mono">{overview.completionRate}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${overview.completionRate}%` }}
              />
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-border bg-background/50 text-center">
              <span className="block text-xl font-bold text-foreground">{overview.totalAssignments}</span>
              <span className="text-[10px] text-muted-foreground uppercase">Total Assignments</span>
            </div>
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
              <span className="block text-xl font-bold text-emerald-400">{overview.completedAssignments}</span>
              <span className="text-[10px] text-emerald-500/80 uppercase">Completed Scores</span>
            </div>
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center">
              <span className="block text-xl font-bold text-amber-400">{overview.inProgressAssignments}</span>
              <span className="text-[10px] text-amber-500/80 uppercase">Drafts in Progress</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-background/50 text-center">
              <span className="block text-xl font-bold text-muted-foreground">{overview.pendingAssignments}</span>
              <span className="text-[10px] text-muted-foreground uppercase">Pending Review</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Judge Workload Table */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-bold">Judge Performance & Workload</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-xs">
          {judgeWorkload.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No judges currently assigned to this event.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5">Judge</th>
                    <th className="p-2.5 text-center">Total</th>
                    <th className="p-2.5 text-center">Completed</th>
                    <th className="p-2.5 text-center">In Progress</th>
                    <th className="p-2.5 text-center">Pending</th>
                    <th className="p-2.5 text-right">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {judgeWorkload.map((j) => (
                    <tr key={j.judgeId} className="hover:bg-muted/20">
                      <td className="p-2.5">
                        <div className="font-medium text-foreground">{j.judgeName}</div>
                        <div className="text-[10px] text-muted-foreground">{j.judgeEmail}</div>
                      </td>
                      <td className="p-2.5 text-center font-mono">{j.total}</td>
                      <td className="p-2.5 text-center font-mono text-emerald-400 font-semibold">{j.completed}</td>
                      <td className="p-2.5 text-center font-mono text-amber-400">{j.inProgress}</td>
                      <td className="p-2.5 text-center font-mono text-muted-foreground">{j.pending}</td>
                      <td className="p-2.5 text-right">
                        <Badge
                          variant={j.completionRate === 100 ? "default" : "secondary"}
                          className={`font-mono text-[10px] ${
                            j.completionRate === 100 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""
                          }`}
                        >
                          {j.completionRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Coverage Overview */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Submission Evaluation Coverage</CardTitle>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">
                Fully Evaluated: {overview.fullyEvaluatedCount}
              </Badge>
              {overview.underEvaluatedCount > 0 && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                  Under-evaluated: {overview.underEvaluatedCount}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs">
          {submissionCoverage.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No submissions are currently being evaluated.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5">Submission</th>
                    <th className="p-2.5">Team</th>
                    <th className="p-2.5 text-center">Assigned</th>
                    <th className="p-2.5 text-center">Completed</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submissionCoverage.map((sub) => (
                    <tr key={sub.submissionId} className="hover:bg-muted/20">
                      <td className="p-2.5 font-medium text-foreground">{sub.submissionTitle}</td>
                      <td className="p-2.5 text-muted-foreground">{sub.teamName}</td>
                      <td className="p-2.5 text-center font-mono">{sub.totalAssigned}</td>
                      <td className="p-2.5 text-center font-mono font-semibold text-foreground">
                        {sub.completedCount}
                      </td>
                      <td className="p-2.5 text-right">
                        {sub.isFullyEvaluated ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                            Complete
                          </Badge>
                        ) : sub.completedCount > 0 ? (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                            In Progress ({sub.completedCount}/{sub.totalAssigned})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Awaiting Scores
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
