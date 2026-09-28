"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Scale,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface NormalizationRunItem {
  id: string;
  version: number;
  method: string;
  parameters: Record<string, unknown>;
  createdAt: string;
  inputScoreCount: number;
  metadata?: {
    overallMean?: string;
    overallStdDev?: string;
    judgeStats?: Array<{
      judgeId: string;
      judgeName: string;
      mean: string;
      stdDev: string;
      range: string;
    }>;
  };
  executedBy?: { name: string; email: string };
  _count?: { normalizedScores: number };
}

export interface JudgeStatsRecord {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  count: number;
  mean: string;
  median: string;
  stdDev: string;
  min: string;
  max: string;
  range: string;
  severityIndicator?: string;
  spreadIndicator?: string;
}

export interface CalibrationPayload {
  totalEvaluations: number;
  overallMean: string;
  overallStdDev: string;
  judgeStats: JudgeStatsRecord[];
}

export interface RankedResultItem {
  submissionId: string;
  title: string;
  teamId: string;
  teamName: string;
  trackId: string | null;
  trackName: string | null;
  prizeId: string | null;
  prizeName: string | null;
  rank: number;
  trackRank: number | null;
  rawAggregateScore: string | number;
  normalizedScore: string | number | null;
  finalScore: string | number;
  scoreCount: number;
  variance: string | number;
  isInsufficient: boolean;
  warnings: string[];
}

export interface RankingsPayload {
  items: RankedResultItem[];
  normalizationRun: { id: string; method: string; version: number } | null;
  totalRanked: number;
  insufficientCount: number;
}

export interface SnapshotItem {
  id: string;
  version: number;
  status: "DRAFT" | "FINALIZED" | "PUBLISHED";
  name: string;
  notes?: string;
  createdAt: string;
  finalizedAt?: string;
  publishedAt?: string;
  createdBy: { name: string; email: string };
  normalizationRun?: { id: string; method: string; version: number } | null;
  _count: { results: number };
}

interface OrganizerResultsDashboardProps {
  eventId: string;
  tracks: { id: string; name: string }[];
  prizes?: { id: string; name: string; value: number | string | null }[];
}

export function OrganizerResultsDashboard({
  eventId,
  tracks,
  prizes: _prizes,
}: OrganizerResultsDashboardProps) {
  const [subTab, setSubTab] = useState<"normalization" | "calibration" | "rankings" | "snapshots">("normalization");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Normalization Run State
  const [method, setMethod] = useState<"Z_SCORE" | "MIN_MAX">("Z_SCORE");
  const [outlierThreshold, setOutlierThreshold] = useState<number>(2.0);
  const [runs, setRuns] = useState<NormalizationRunItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // Calibration Analytics State
  const [calibrationData, setCalibrationData] = useState<CalibrationPayload | null>(null);

  // Rankings State
  const [rankings, setRankings] = useState<RankingsPayload | null>(null);
  const [filterTrackId, setFilterTrackId] = useState<string>("");

  // Snapshots State
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapshotName, setSnapshotName] = useState<string>("");
  const [snapshotNotes, setSnapshotNotes] = useState<string>("");
  const [confirmPublish, setConfirmPublish] = useState(false);

  // Fetch runs and calibration
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/normalization/runs`);
      const json = await res.json();
      if (res.ok && json.data) {
        setRuns(json.data);
        if (json.data.length > 0 && !selectedRunId) {
          setSelectedRunId(json.data[0].id);
        }
      }
    } catch {
      // Ignore
    }
  }, [eventId, selectedRunId]);

  const fetchCalibration = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/normalization/calibration`);
      const json = await res.json();
      if (res.ok && json.data) {
        setCalibrationData(json.data);
      }
    } catch {
      // Ignore
    }
  }, [eventId]);

  const fetchRankings = useCallback(async (runId?: string, trackId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/results/rankings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          normalizationRunId: runId || (selectedRunId || undefined),
          trackId: trackId || (filterTrackId || undefined),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to calculate rankings.");
      setRankings(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to calculate rankings.");
    } finally {
      setLoading(false);
    }
  }, [eventId, selectedRunId, filterTrackId]);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/results/snapshots`);
      const json = await res.json();
      if (res.ok && json.data) {
        setSnapshots(json.data);
      }
    } catch {
      // Ignore
    }
  }, [eventId]);

  useEffect(() => {
    fetchRuns();
    fetchCalibration();
    fetchSnapshots();
  }, [fetchRuns, fetchCalibration, fetchSnapshots]);

  const handleRunNormalization = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/events/${eventId}/normalization/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          outlierThreshold: Number(outlierThreshold),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to execute normalization.");

      setSuccess(`Normalization run v${json.data.run.version} completed successfully (${json.data.normalizedScoreCount} evaluations calibrated).`);
      await fetchRuns();
      await fetchCalibration();
      setSelectedRunId(json.data.run.id);
      fetchRankings(json.data.run.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute normalization.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/events/${eventId}/results/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          normalizationRunId: selectedRunId || undefined,
          name: snapshotName || undefined,
          notes: snapshotNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create result snapshot.");

      setSuccess(`Result snapshot v${json.data.version} created in DRAFT status.`);
      setSnapshotName("");
      setSnapshotNotes("");
      await fetchSnapshots();
      setSubTab("snapshots");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create result snapshot.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeSnapshot = async (snapshotId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/results/snapshots/${snapshotId}/finalize`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to finalize snapshot.");
      setSuccess("Snapshot finalized and locked for review.");
      await fetchSnapshots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to finalize snapshot.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishSnapshot = async (snapshotId: string) => {
    if (!confirmPublish) {
      setError("Please check the confirmation box before publishing official results.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/results/snapshots/${snapshotId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPublish: true, transitionEventState: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to publish snapshot.");
      setSuccess("Official results have been published! Public leaderboard is now active.");
      await fetchSnapshots();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish snapshot.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Results Sub-Tabs */}
      <div className="flex border-b border-border space-x-2">
        <button
          onClick={() => setSubTab("normalization")}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "normalization"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          <span>1. Normalization Engine</span>
        </button>
        <button
          onClick={() => {
            setSubTab("calibration");
            fetchCalibration();
          }}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "calibration"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>2. Judge Calibration & Fairness</span>
        </button>
        <button
          onClick={() => {
            setSubTab("rankings");
            fetchRankings();
          }}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "rankings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>3. Rankings & Ties</span>
        </button>
        <button
          onClick={() => {
            setSubTab("snapshots");
            fetchSnapshots();
          }}
          className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "snapshots"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>4. Snapshots & Publication ({snapshots.length})</span>
        </button>
      </div>

      {/* Tab 1: Normalization Engine */}
      {subTab === "normalization" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <span>Run Score Normalization</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Calibrate judge scoring distributions to eliminate severity and leniency bias. Raw judge scores remain strictly unaltered.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Normalization Algorithm</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as "Z_SCORE" | "MIN_MAX")}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Z_SCORE">Z-Score Normalization (Standard Deviation Scaled)</option>
                    <option value="MIN_MAX">Min-Max Normalization (0-100 Relative Range)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {method === "Z_SCORE"
                      ? "Standardizes each judge's distribution around mean 50.00 with standard deviation scaling (T-score). Handles zero variance safely."
                      : "Scales each judge's minimum score to 0 and maximum to 100. Handles equal min/max by mapping to 50.00."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">
                    Outlier Flagging Threshold (|z| score)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="4.0"
                    value={outlierThreshold}
                    onChange={(e) => setOutlierThreshold(Number(e.target.value))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Scores deviating beyond this number of standard deviations are flagged for fairness review. Outliers are never automatically deleted.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleRunNormalization}
                  disabled={actionLoading}
                  className="text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                  <span>Execute Normalization Run</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Previous Runs Table */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span>Historical Normalization Runs ({runs.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No normalization runs have been generated yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Version</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Evaluations</th>
                        <th className="py-2.5 px-3">Executed By</th>
                        <th className="py-2.5 px-3">Created At</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {runs.map((r) => (
                        <tr key={r.id} className={selectedRunId === r.id ? "bg-primary/5" : ""}>
                          <td className="py-2.5 px-3 font-semibold text-foreground">
                            Run v{r.version}
                            {selectedRunId === r.id && (
                              <Badge variant="outline" className="ml-2 text-[10px] bg-primary/10 text-primary">
                                Active Selection
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">{r.method}</td>
                          <td className="py-2.5 px-3 text-foreground">{r.inputScoreCount}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{r.executedBy?.name || "System"}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRunId(r.id);
                                fetchRankings(r.id);
                                setSubTab("rankings");
                              }}
                              className="text-[11px] h-7 px-2"
                            >
                              Inspect Rankings
                            </Button>
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
      )}

      {/* Tab 2: Calibration & Fairness */}
      {subTab === "calibration" && (
        <div className="space-y-6">
          {calibrationData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-card/60 p-3 text-center">
                <span className="block text-xl font-bold text-foreground">
                  {calibrationData.totalEvaluations}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Total Evaluations
                </span>
              </div>
              <div className="rounded-lg border border-border bg-card/60 p-3 text-center">
                <span className="block text-xl font-bold text-foreground">
                  {calibrationData.overallMean}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Overall Event Mean
                </span>
              </div>
              <div className="rounded-lg border border-border bg-card/60 p-3 text-center">
                <span className="block text-xl font-bold text-foreground">
                  {calibrationData.overallStdDev}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Overall Population Std Dev
                </span>
              </div>
              <div className="rounded-lg border border-border bg-card/60 p-3 text-center">
                <span className="block text-xl font-bold text-foreground">
                  {calibrationData.judgeStats.length}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Judges Evaluated
                </span>
              </div>
            </div>
          )}

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Judge Scoring Distributions & Calibration Indicators</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Statistical analysis of judge evaluation behavior. Used as calibration signals to identify relative severity differences.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {!calibrationData || calibrationData.judgeStats.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No finalized judge scores available for calibration analysis.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Judge</th>
                        <th className="py-2.5 px-3 text-center">Evaluations</th>
                        <th className="py-2.5 px-3 text-right">Mean</th>
                        <th className="py-2.5 px-3 text-right">Median</th>
                        <th className="py-2.5 px-3 text-right">Std Dev</th>
                        <th className="py-2.5 px-3 text-right">Min - Max</th>
                        <th className="py-2.5 px-3 text-right">Range</th>
                        <th className="py-2.5 px-3 text-center">Calibration Signal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {calibrationData.judgeStats.map((j) => (
                        <tr key={j.judgeId} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{j.judgeName}</td>
                          <td className="py-2.5 px-3 text-center text-foreground">{j.count}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-foreground">{j.mean}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-foreground">{j.median}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-foreground">{j.stdDev}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {j.min} - {j.max}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{j.range}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                j.severityIndicator === "LENIENT"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : j.severityIndicator === "STRICT"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {j.severityIndicator}
                            </span>
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
      )}

      {/* Tab 3: Rankings & Ties */}
      {subTab === "rankings" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={filterTrackId}
                onChange={(e) => {
                  setFilterTrackId(e.target.value);
                  fetchRankings(selectedRunId, e.target.value);
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Tracks (Overall Ranking)</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    Track: {t.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedRunId}
                onChange={(e) => {
                  setSelectedRunId(e.target.value);
                  fetchRankings(e.target.value, filterTrackId);
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No Normalization (Raw Weighted Scores)</option>
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Normalization Run v{r.version} ({r.method})
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRankings(selectedRunId, filterTrackId)}
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <Button
              onClick={handleCreateSnapshot}
              disabled={actionLoading || !rankings || rankings.items.length === 0}
              className="text-xs font-semibold flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Snapshot Current Rankings</span>
            </Button>
          </div>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Deterministic Aggregated Leaderboard</span>
                </CardTitle>
                {rankings && (
                  <div className="text-xs text-muted-foreground">
                    Total Ranked: <span className="text-foreground font-semibold">{rankings.totalRanked}</span>
                    {rankings.insufficientCount > 0 && (
                      <span className="text-amber-400 ml-2">({rankings.insufficientCount} with warnings)</span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!rankings || rankings.items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No projects currently ranked. Ensure submissions are in SUBMITTED or LOCKED state and finalized scores exist.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border text-muted-foreground font-medium">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Rank</th>
                        <th className="py-2.5 px-3">Project & Team</th>
                        <th className="py-2.5 px-3">Track</th>
                        <th className="py-2.5 px-3 text-right">Raw Score</th>
                        <th className="py-2.5 px-3 text-right">Normalized</th>
                        <th className="py-2.5 px-3 text-right">Final Score</th>
                        <th className="py-2.5 px-3 text-center">Reviews</th>
                        <th className="py-2.5 px-3 text-right">Prize Allocation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {rankings.items.map((item) => (
                        <tr key={item.submissionId} className="hover:bg-muted/10">
                          <td className="py-2.5 px-3 text-center font-bold">
                            {item.rank === 1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400">
                                1
                              </span>
                            ) : item.rank === 2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300">
                                2
                              </span>
                            ) : item.rank === 3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600">
                                3
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{item.rank}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-foreground block">{item.title}</span>
                            <span className="text-[11px] text-muted-foreground">{item.teamName}</span>
                            {item.warnings.length > 0 && (
                              <span className="text-[10px] text-amber-400 block mt-0.5">
                                ⚠ {item.warnings[0]}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {item.trackName || "General"}
                            {item.trackRank && (
                              <span className="text-[10px] text-primary block">Track #{item.trackRank}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {Number(item.rawAggregateScore).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {item.normalizedScore ? Number(item.normalizedScore).toFixed(2) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {Number(item.finalScore).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-muted-foreground">
                            {item.scoreCount}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {item.prizeName ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                                🏆 {item.prizeName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
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
      )}

      {/* Tab 4: Snapshots & Publication */}
      {subTab === "snapshots" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>Result Snapshots & Publication Governance</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Snapshots freeze ranked outcomes. Publishing a snapshot makes it publicly visible on the official leaderboard and locks it as unalterable historical evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {snapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No snapshots created yet. Navigate to &ldquo;Rankings & Ties&rdquo; and click &ldquo;Snapshot Current Rankings&rdquo;.
                </p>
              ) : (
                <div className="space-y-4">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="rounded-lg border border-border p-4 bg-background/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {snap.name || `Snapshot v${snap.version}`}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              snap.status === "PUBLISHED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : snap.status === "FINALIZED"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {snap.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {snap._count?.results || 0} ranked projects • Created by {snap.createdBy?.name || "Organizer"} on{" "}
                          {new Date(snap.createdAt).toLocaleString()}
                        </p>
                        {snap.publishedAt && (
                          <p className="text-[11px] text-emerald-400">
                            ✓ Published publicly on {new Date(snap.publishedAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {snap.status === "DRAFT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => handleFinalizeSnapshot(snap.id)}
                            className="text-xs"
                          >
                            Lock as Finalized
                          </Button>
                        )}

                        {snap.status !== "PUBLISHED" && (
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={confirmPublish}
                                onChange={(e) => setConfirmPublish(e.target.checked)}
                                className="rounded border-border"
                              />
                              <span>Confirm release</span>
                            </label>
                            <Button
                              size="sm"
                              disabled={actionLoading || !confirmPublish}
                              onClick={() => handlePublishSnapshot(snap.id)}
                              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Publish Official Results
                            </Button>
                          </div>
                        )}

                        {snap.status === "PUBLISHED" && (
                          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400">
                            Immutable Historical Record
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
