"use client";

import * as React from "react";
import {
  Shuffle,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  BarChart3,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AssignmentGenerationReport } from "@/server/services/assignment.service";

interface AssignmentGeneratorProps {
  eventId: string;
  tracks?: Array<{ id: string; name: string }>;
  onAssignmentsGenerated?: () => void;
}

interface BatchItem {
  id: string;
  algorithm: string;
  parameters: Record<string, unknown> | null;
  submissionCount: number;
  judgeCount: number;
  assignmentCount: number;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

export function AssignmentGenerator({
  eventId,
  tracks = [],
  onAssignmentsGenerated,
}: AssignmentGeneratorProps) {
  const [targetJudges, setTargetJudges] = React.useState<number>(2);
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<AssignmentGenerationReport | null>(null);

  // Past batches
  const [batches, setBatches] = React.useState<BatchItem[]>([]);
  const [_isLoadingBatches, setIsLoadingBatches] = React.useState(false);

  const fetchBatches = React.useCallback(async () => {
    try {
      setIsLoadingBatches(true);
      const res = await fetch(`/api/events/${eventId}/judging/batches`);
      const data = await res.json();
      if (res.ok) {
        setBatches(data.data || []);
      }
    } catch {
      // Non-critical background fetch
    } finally {
      setIsLoadingBatches(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      setError(null);
      setReport(null);

      const res = await fetch(`/api/events/${eventId}/judging/assignments/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetJudgesPerSubmission: Number(targetJudges),
          trackId: selectedTrackId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to generate judge assignments.");
      }

      setReport(data.data);
      await fetchBatches();
      if (onAssignmentsGenerated) {
        onAssignmentsGenerated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate assignments.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generator Configuration Card */}
      <Card className="border-border bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-bold">Deterministic Balanced Judge Assignment</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Distribute eligible project submissions evenly across active judges with strict conflict-of-interest detection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Target Judges Per Submission *
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  required
                  value={targetJudges}
                  onChange={(e) => setTargetJudges(parseInt(e.target.value) || 1)}
                  className="h-8 text-xs"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Recommended: 2 or 3 evaluations per submission.
                </span>
              </div>

              {tracks.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Filter by Track (Optional)
                  </label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All Tracks (Global)</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-muted-foreground block">
                    Assign only submissions belonging to this track.
                  </span>
                </div>
              )}
            </div>

            {/* Conflict & Integrity Notice */}
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Guaranteed Conflict Protection
              </div>
              <p className="text-[11px] text-muted-foreground">
                Judges who are team captains, creators, or members of a submission are strictly prevented from evaluating that submission. Workloads are balanced deterministically across judges with minimal deviation.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isGenerating}
                className="text-xs gap-1.5"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shuffle className="h-3.5 w-3.5" />
                )}
                Run Assignment Algorithm
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Generation Report Results */}
      {report && (
        <Card className="border-emerald-500/30 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Assignment Batch Generated
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Batch #{report.batchId.slice(0, 8)}
                </Badge>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 text-[10px]">
                Algorithm: {report.algorithm}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg border border-border bg-background/50 text-center">
                <span className="block text-lg font-bold text-foreground">{report.totalAssignmentsCreated}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Assignments Created</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-background/50 text-center">
                <span className="block text-lg font-bold text-foreground">{report.totalSubmissions}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Submissions Evaluated</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-background/50 text-center">
                <span className="block text-lg font-bold text-foreground">{report.totalJudges}</span>
                <span className="text-[10px] text-muted-foreground uppercase">Active Judges</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-background/50 text-center">
                <span className="block text-lg font-bold text-emerald-400">
                  {report.judgeWorkloadStats.average}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">Avg Load / Judge</span>
              </div>
            </div>

            {/* Under-assignment Warnings */}
            {report.underAssignedCount > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5 text-xs text-amber-300">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Under-Assigned Submissions ({report.underAssignedCount})
                </div>
                <p className="text-[11px] text-amber-200/80">
                  The following submissions received fewer than {report.targetCoverage} assignments due to judge conflict-of-interest blocks or judge pool capacity limits:
                </p>
                <div className="space-y-1 pt-1">
                  {report.underAssignedDetails.map((item) => (
                    <div key={item.submissionId} className="flex justify-between items-center text-[11px] bg-background/40 px-2 py-1 rounded">
                      <span className="font-medium">{item.title}</span>
                      <span>{item.assignedCount} / {report.targetCoverage} judges</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Judge Workload Breakdown */}
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Workload Distribution (Min: {report.judgeWorkloadStats.min}, Max: {report.judgeWorkloadStats.max})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {report.judgeWorkloadStats.distribution.map((j) => (
                  <div key={j.judgeId} className="flex justify-between items-center p-2 rounded border border-border bg-background/40 text-[11px]">
                    <span className="font-medium truncate">{j.judgeName}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {j.count} projects
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Batches */}
      {batches.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Historical Assignment Batches ({batches.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="divide-y divide-border rounded-md border border-border bg-background/30 overflow-hidden">
              {batches.map((b) => (
                <div key={b.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">Batch #{b.id.slice(0, 8)}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {b.algorithm}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      Generated by {b.createdBy.name} on {new Date(b.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-muted-foreground">
                      Submissions: <strong className="text-foreground">{b.submissionCount}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Judges: <strong className="text-foreground">{b.judgeCount}</strong>
                    </span>
                    <Badge variant="outline" className="text-emerald-400 font-mono text-[10px]">
                      {b.assignmentCount} assignments
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
