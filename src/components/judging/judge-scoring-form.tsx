"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  Save,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Github,
  Video,
  Globe,
  Info,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Criterion {
  id: string;
  name: string;
  description?: string | null;
  weight: number | string;
  maxScore: number | string;
  order: number;
}

interface ScoreItem {
  criterionId: string;
  rawScore: number | string;
  feedback?: string | null;
}

interface EvaluationData {
  assignment: {
    id: string;
    status: string;
    eventId: string;
    event: { id: string; name: string; state: string };
    submission: {
      id: string;
      title: string;
      description: string;
      repositoryUrl?: string | null;
      videoUrl?: string | null;
      demoUrl?: string | null;
      team: { id: string; name: string };
      track?: { id: string; name: string } | null;
      versions: Array<{ id: string; versionNumber: number; title: string }>;
    };
  };
  rubricVersion: {
    id: string;
    version: number;
    criteria: Criterion[];
  };
  score?: {
    id: string;
    isFinal: boolean;
    score: number | string;
    feedback?: string | null;
    items: Array<{
      id: string;
      criterionId: string;
      rawScore: number | string;
      feedback?: string | null;
    }>;
  } | null;
  isFinal: boolean;
}

interface JudgeScoringFormProps {
  assignmentId: string;
}

export function JudgeScoringForm({ assignmentId }: JudgeScoringFormProps) {
  const router = useRouter();
  const [data, setData] = React.useState<EvaluationData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // Form state
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [criterionFeedbacks, setCriterionFeedbacks] = React.useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = React.useState<string>("");

  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  const fetchEvaluation = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/judge/assignments/${assignmentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load evaluation.");

      const evalData: EvaluationData = json.data;
      setData(evalData);

      // Initialize form values from existing score (if draft or final)
      if (evalData.score) {
        setOverallFeedback(evalData.score.feedback || "");
        const sMap: Record<string, number> = {};
        const fMap: Record<string, string> = {};
        for (const item of evalData.score.items) {
          sMap[item.criterionId] = Number(item.rawScore);
          if (item.feedback) fMap[item.criterionId] = item.feedback;
        }
        setScores(sMap);
        setCriterionFeedbacks(fMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluation.");
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId]);

  React.useEffect(() => {
    fetchEvaluation();
  }, [fetchEvaluation]);

  // Compute live weighted score
  const liveScore = React.useMemo(() => {
    if (!data?.rubricVersion.criteria) return "0.00";
    const criteria = data.rubricVersion.criteria;
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
    const weightIsPercentage = totalWeight > 1.5;

    let weightedSum = 0;
    for (const c of criteria) {
      const raw = scores[c.id] ?? 0;
      const max = Number(c.maxScore) || 10;
      const w = Number(c.weight) || 0;
      const normalizedRatio = max > 0 ? raw / max : 0;

      if (weightIsPercentage) {
        weightedSum += normalizedRatio * w;
      } else {
        weightedSum += normalizedRatio * (w * 100);
      }
    }

    return weightedSum.toFixed(2);
  }, [data, scores]);

  const handleScoreChange = (criterionId: string, value: number, maxScore: number) => {
    if (data?.isFinal) return;
    const clamped = Math.max(0, Math.min(value, maxScore));
    setScores((prev) => ({ ...prev, [criterionId]: clamped }));
  };

  const handleSaveDraft = async () => {
    if (!data || data.isFinal) return;
    try {
      setIsSavingDraft(true);
      setError(null);
      setSuccessMsg(null);

      const items: ScoreItem[] = Object.entries(scores).map(([criterionId, rawScore]) => ({
        criterionId,
        rawScore,
        feedback: criterionFeedbacks[criterionId] || undefined,
      }));

      const res = await fetch(`/api/judge/assignments/${assignmentId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: overallFeedback || undefined,
          items,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save draft.");

      setSuccessMsg("Draft score saved successfully. You can return to finalize anytime.");
      await fetchEvaluation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleFinalize = async () => {
    if (!data || data.isFinal) return;
    try {
      setIsFinalizing(true);
      setError(null);
      setSuccessMsg(null);

      // Verify all criteria scored
      const missing = data.rubricVersion.criteria.filter((c) => scores[c.id] === undefined);
      if (missing.length > 0) {
        throw new Error(
          `Please evaluate all criteria before finalizing. Missing: ${missing.map((m) => m.name).join(", ")}.`
        );
      }

      const items: ScoreItem[] = data.rubricVersion.criteria.map((c) => ({
        criterionId: c.id,
        rawScore: scores[c.id] ?? 0,
        feedback: criterionFeedbacks[c.id] || undefined,
      }));

      const res = await fetch(`/api/judge/assignments/${assignmentId}/score/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: overallFeedback || undefined,
          items,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to finalize score.");

      setShowConfirmModal(false);
      setSuccessMsg("Score finalized successfully! Evaluation is permanently locked as official evidence.");
      await fetchEvaluation();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize score.");
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
        <h4 className="text-sm font-semibold text-destructive">{error}</h4>
        <Link
          href="/judge"
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Judge Portal
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { assignment, rubricVersion, isFinal } = data;
  const sub = assignment.submission;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/judge"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Judge Portal
        </Link>
        <Badge
          variant={isFinal ? "default" : "secondary"}
          className={`text-xs ${
            isFinal
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-amber-500/20 text-amber-300 border-amber-500/30"
          }`}
        >
          {isFinal ? "Score Finalized & Locked" : "Evaluation in Progress"}
        </Badge>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Immutable Score Lock Banner */}
      {isFinal && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs flex items-start gap-3">
          <Lock className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-foreground block text-sm">
              Evaluation Officially Finalized
            </span>
            <p className="text-muted-foreground mt-0.5">
              This score has been recorded as immutable historical evidence. The evaluation, criteria scores, and feedback cannot be altered or deleted.
            </p>
          </div>
        </div>
      )}

      {/* Submission Information Dossier */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{sub.title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                By team <strong className="text-foreground">{sub.team.name}</strong> • Event: {assignment.event.name}
              </CardDescription>
            </div>
            {sub.track && (
              <Badge variant="outline" className="text-xs">
                Track: {sub.track.name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {sub.description}
          </p>

          {/* Submission Links */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {sub.repositoryUrl && (
              <a
                href={sub.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted font-medium transition-colors"
              >
                <Github className="h-3.5 w-3.5" /> Source Code <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            )}
            {sub.demoUrl && (
              <a
                href={sub.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted font-medium transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-primary" /> Live Demo <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            )}
            {sub.videoUrl && (
              <a
                href={sub.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted font-medium transition-colors"
              >
                <Video className="h-3.5 w-3.5 text-amber-400" /> Demo Video <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rubric Evaluation Form */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Judging Criteria (Rubric v{rubricVersion.version})</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Weighted Aggregate:</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {liveScore} / 100
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4 text-xs">
          {rubricVersion.criteria.map((c) => {
            const raw = scores[c.id] ?? 0;
            const max = Number(c.maxScore) || 10;
            const w = Number(c.weight) || 0;
            const feedback = criterionFeedbacks[c.id] || "";

            return (
              <div key={c.id} className="p-3.5 rounded-lg border border-border bg-background/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{c.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Weight: {w}%
                      </Badge>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-foreground">
                      {raw} / {max}
                    </span>
                  </div>
                </div>

                {/* Score Slider & Input */}
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={raw}
                    disabled={isFinal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleScoreChange(c.id, parseFloat(e.target.value), max)
                    }
                    className="flex-1 accent-primary h-2 bg-muted rounded-lg cursor-pointer disabled:cursor-not-allowed"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step="any"
                    disabled={isFinal}
                    value={raw}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleScoreChange(c.id, parseFloat(e.target.value) || 0, max)
                    }
                    className="w-16 h-8 text-xs font-mono text-center"
                  />
                </div>

                {/* Criterion Feedback */}
                <div>
                  <Input
                    placeholder="Specific notes or critique for this criterion (optional)..."
                    disabled={isFinal}
                    value={feedback}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCriterionFeedbacks((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="h-7 text-xs bg-background/60"
                  />
                </div>
              </div>
            );
          })}

          {/* Overall Qualitative Feedback */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium text-foreground">
              Overall Evaluation & Qualitative Feedback (Optional)
            </label>
            <Textarea
              disabled={isFinal}
              rows={4}
              value={overallFeedback}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOverallFeedback(e.target.value)}
              placeholder="Provide constructive feedback, praise, and improvement areas for the team..."
              className="text-xs bg-background/60"
            />
          </div>

          {/* Action Buttons */}
          {!isFinal && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Drafts are confidential and can be adjusted until finalized.
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingDraft || isFinalizing}
                  onClick={handleSaveDraft}
                  className="text-xs gap-1.5"
                >
                  {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingDraft || isFinalizing}
                  onClick={() => setShowConfirmModal(true)}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Finalize Evaluation
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finalize Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-foreground">
                <Lock className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base">Confirm Score Finalization</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Finalizing this score will officially lock it as historical evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-1 text-amber-200">
                <span className="font-semibold block">⚠️ Permanent Action</span>
                <p className="text-[11px]">
                  Once finalized, this score cannot be edited, rescinded, or deleted by you or the event organizers. The weighted score will be:
                </p>
                <div className="text-base font-bold font-mono text-emerald-400 pt-1">
                  {liveScore} / 100 points
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFinalizing}
                  onClick={() => setShowConfirmModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isFinalizing}
                  onClick={handleFinalize}
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isFinalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Confirm & Finalize
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
