"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Plus,
  Loader2,
  AlertTriangle,
  Lock,
  Ban,
  RotateCcw,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { EventState } from "@prisma/client";
import { RubricManager } from "@/components/judging/rubric-manager";
import { AssignmentGenerator } from "@/components/judging/assignment-generator";
import { JudgingProgressCard } from "@/components/judging/judging-progress-card";
import { OrganizerResultsDashboard } from "@/components/results/organizer-results-dashboard";
import { OrganizerCommunityDashboard } from "@/components/community/organizer-community-dashboard";
import { EventAuditTrail } from "@/components/events/event-audit-trail";

const NEXT_STATE_ACTIONS: Record<EventState, { target: EventState; label: string; desc: string }[]> = {
  DRAFT: [
    { target: "REGISTRATION_OPEN", label: "Open Registration", desc: "Allow participants to discover and register for the event." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Cancel and archive this draft event." },
  ],
  REGISTRATION_OPEN: [
    { target: "REGISTRATION_CLOSED", label: "Close Registration", desc: "Stop accepting new participant registrations." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  REGISTRATION_CLOSED: [
    { target: "SUBMISSIONS_OPEN", label: "Open Submissions", desc: "Allow teams to start submitting project entries." },
    { target: "REGISTRATION_OPEN", label: "Re-open Registration", desc: "Allow more participants to register." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  SUBMISSIONS_OPEN: [
    { target: "SUBMISSIONS_CLOSED", label: "Close Submissions", desc: "Lock project submissions for evaluation." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  SUBMISSIONS_CLOSED: [
    { target: "JUDGING_OPEN", label: "Start Judging", desc: "Begin rubric evaluation round." },
    { target: "SUBMISSIONS_OPEN", label: "Re-open Submissions", desc: "Allow teams to update submissions." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  JUDGING_OPEN: [
    { target: "JUDGING_CLOSED", label: "Conclude Judging", desc: "Freeze judge scoring." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  JUDGING_CLOSED: [
    { target: "RESULTS_PUBLISHED", label: "Publish Results", desc: "Make final rankings and winners public." },
    { target: "JUDGING_OPEN", label: "Re-open Judging", desc: "Allow judges to revise scores." },
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive this event." },
  ],
  RESULTS_PUBLISHED: [
    { target: "ARCHIVED", label: "Archive Event", desc: "Archive the completed hackathon." },
  ],
  ARCHIVED: [],
};

interface TrackItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

interface PrizeItem {
  id: string;
  name: string;
  description: string | null;
  value: number | string | null;
  track?: { name: string } | null;
}

interface ParticipantItem {
  id: string;
  role: string;
  status: string;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface TeamItem {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | string;
  creator: { name: string; email: string };
  track?: { name: string } | null;
  members: { id: string; user: { name: string } }[];
}

interface SubmissionItem {
  id: string;
  title: string;
  description: string;
  state: "DRAFT" | "SUBMITTED" | "LOCKED" | "DISQUALIFIED";
  submittedAt: Date | string | null;
  lockedAt: Date | string | null;
  updatedAt: Date | string;
  team: { id: string; name: string; slug: string };
  track?: { id: string; name: string } | null;
  versions?: { versionNumber: number }[];
}

interface OrganizerDashboardProps {
  event: {
    id: string;
    name: string;
    slug: string;
    state: EventState;
    description: string | null;
    isVirtual: boolean;
    location: string | null;
    minTeamSize: number;
    maxTeamSize: number;
    tracks: TrackItem[];
    prizes: PrizeItem[];
    memberships: ParticipantItem[];
    teams: TeamItem[];
    submissions?: SubmissionItem[];
  };
}

export function OrganizerDashboard({ event }: OrganizerDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<
    "lifecycle" | "submissions" | "participants" | "teams" | "tracks" | "prizes" | "judging" | "results" | "community" | "audit"
  >("lifecycle");
  const [judgingSubTab, setJudgingSubTab] = React.useState<"progress" | "assignments" | "rubrics">("progress");

  // State Transition state
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [transitionError, setTransitionError] = React.useState<string | null>(null);

  // Submissions action state
  const [submissionActionLoading, setSubmissionActionLoading] = React.useState<string | null>(null);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  // New Track form state
  const [trackName, setTrackName] = React.useState("");
  const [trackDesc, setTrackDesc] = React.useState("");
  const [isAddingTrack, setIsAddingTrack] = React.useState(false);
  const [trackError, setTrackError] = React.useState<string | null>(null);

  // New Prize form state
  const [prizeName, setPrizeName] = React.useState("");
  const [prizeDesc, setPrizeDesc] = React.useState("");
  const [prizeValue, setPrizeValue] = React.useState("");
  const [prizeTrackId, setPrizeTrackId] = React.useState("");
  const [isAddingPrize, setIsAddingPrize] = React.useState(false);
  const [prizeError, setPrizeError] = React.useState<string | null>(null);

  const handleStateTransition = async (targetState: EventState) => {
    if (!confirm(`Are you sure you want to transition this event to '${targetState}'?`)) return;

    setIsTransitioning(true);
    setTransitionError(null);

    try {
      const res = await fetch(`/api/events/${event.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: targetState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Transition failed.");
      }

      router.refresh();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Transition failed.");
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCreateTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingTrack(true);
    setTrackError(null);

    try {
      const res = await fetch(`/api/events/${event.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trackName,
          description: trackDesc || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create track.");
      }

      setTrackName("");
      setTrackDesc("");
      router.refresh();
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : "Failed to create track.");
    } finally {
      setIsAddingTrack(false);
    }
  };

  const handleCreatePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingPrize(true);
    setPrizeError(null);

    try {
      const res = await fetch(`/api/events/${event.id}/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prizeName,
          description: prizeDesc || undefined,
          value: prizeValue ? Number(prizeValue) : undefined,
          trackId: prizeTrackId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create prize.");
      }

      setPrizeName("");
      setPrizeDesc("");
      setPrizeValue("");
      setPrizeTrackId("");
      router.refresh();
    } catch (err) {
      setPrizeError(err instanceof Error ? err.message : "Failed to create prize.");
    } finally {
      setIsAddingPrize(false);
    }
  };

  const handleLockSubmission = async (submissionId: string) => {
    if (!confirm("Are you sure you want to lock this submission? No further edits will be permitted.")) return;
    setSubmissionActionLoading(submissionId);
    setSubmissionError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/lock`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to lock submission.");
      router.refresh();
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Failed to lock submission.");
    } finally {
      setSubmissionActionLoading(null);
    }
  };

  const handleDisqualifySubmission = async (submissionId: string) => {
    const reason = prompt("Enter disqualification reason (optional):");
    if (reason === null) return;
    setSubmissionActionLoading(submissionId);
    setSubmissionError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/disqualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "Disqualified by event organizer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to disqualify submission.");
      router.refresh();
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Failed to disqualify submission.");
    } finally {
      setSubmissionActionLoading(null);
    }
  };

  const handleRestoreSubmission = async (submissionId: string) => {
    if (!confirm("Are you sure you want to restore this submission to SUBMITTED status?")) return;
    setSubmissionActionLoading(submissionId);
    setSubmissionError(null);
    try {
      const res = await fetch(`/api/submissions/${submissionId}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to restore submission.");
      router.refresh();
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : "Failed to restore submission.");
    } finally {
      setSubmissionActionLoading(null);
    }
  };

  const submissions = event.submissions || [];
  const submittedCount = submissions.filter((s) => s.state === "SUBMITTED").length;
  const lockedCount = submissions.filter((s) => s.state === "LOCKED").length;
  const disqualifiedCount = submissions.filter((s) => s.state === "DISQUALIFIED").length;
  const draftCount = submissions.filter((s) => s.state === "DRAFT").length;

  const nextActions = NEXT_STATE_ACTIONS[event.state] || [];

  return (
    <div className="space-y-8">
      {/* Top Console Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card/60 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            {event.name}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Current Stage: <strong className="text-foreground font-mono">{event.state}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export.csv"
            download="hackathon-export.csv"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-1 hover:bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Export Event CSV (RFC-4180)</span>
          </a>
        </div>
      </div>

      {/* Navigation Tabs (Linear-style segmented scrollable pill bar) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none p-1.5 rounded-xl bg-surface-1/90 border border-border">
        <button
          type="button"
          onClick={() => setActiveTab("lifecycle")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "lifecycle"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Lifecycle & Governance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("submissions")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "submissions"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Submissions ({submissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("participants")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "participants"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Participants ({event.memberships.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("teams")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "teams"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Teams ({event.teams.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tracks")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "tracks"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Tracks ({event.tracks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prizes")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "prizes"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Prizes ({event.prizes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("judging")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "judging"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Judging & Rubrics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("results")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "results"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Results & Fairness
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("community")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "community"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Community & Voting
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "audit"
              ? "bg-card text-primary shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          Audit Trail
        </button>
      </div>

      {/* Tab: Submissions */}
      {activeTab === "submissions" && (
        <div className="space-y-6">
          {submissionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{submissionError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border bg-card/60 p-3 text-center">
              <span className="block text-xl font-bold text-foreground">{submissions.length}</span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</span>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <span className="block text-xl font-bold text-emerald-400">{submittedCount}</span>
              <span className="text-[11px] text-emerald-500/80 uppercase tracking-wider">Submitted</span>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-center">
              <span className="block text-xl font-bold text-blue-400">{lockedCount}</span>
              <span className="text-[11px] text-blue-500/80 uppercase tracking-wider">Locked</span>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <span className="block text-xl font-bold text-amber-400">{draftCount}</span>
              <span className="text-[11px] text-amber-500/80 uppercase tracking-wider">Draft</span>
            </div>
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-center">
              <span className="block text-xl font-bold text-rose-400">{disqualifiedCount}</span>
              <span className="text-[11px] text-rose-500/80 uppercase tracking-wider">Disqualified</span>
            </div>
          </div>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Project Submissions ({submissions.length})
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Review submitted entries, inspect snapshot versions, lock entries for judging, or moderate eligibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {submissions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  No submissions have been recorded for this event yet.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {submissions.map((sub) => {
                    const isActing = submissionActionLoading === sub.id;
                    const latestVersion = sub.versions?.[0]?.versionNumber ?? 1;

                    return (
                      <div
                        key={sub.id}
                        className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">
                              {sub.title || "Untitled Draft"}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                sub.state === "SUBMITTED"
                                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                  : sub.state === "LOCKED"
                                  ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                                  : sub.state === "DISQUALIFIED"
                                  ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                                  : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              }
                            >
                              {sub.state}
                            </Badge>
                            {sub.track && (
                              <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">
                                {sub.track.name}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              v{latestVersion}
                            </span>
                          </div>
                          <p className="text-muted-foreground line-clamp-1">
                            {sub.description || "No project summary provided."}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>Team: <strong className="text-foreground">{sub.team.name}</strong></span>
                            {sub.submittedAt && (
                              <span>Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(sub.state === "SUBMITTED" || sub.state === "LOCKED") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1"
                              onClick={() => window.open(`/gallery/${sub.id}`, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>View Gallery</span>
                            </Button>
                          )}

                          {sub.state === "SUBMITTED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isActing}
                              className="text-xs h-7 gap-1 text-blue-400 hover:text-blue-300 border-blue-500/30"
                              onClick={() => handleLockSubmission(sub.id)}
                            >
                              {isActing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Lock className="h-3 w-3" />
                              )}
                              <span>Lock</span>
                            </Button>
                          )}

                          {(sub.state === "SUBMITTED" || sub.state === "LOCKED") && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isActing}
                              className="text-xs h-7 gap-1 text-rose-400 hover:text-rose-300 border-rose-500/30"
                              onClick={() => handleDisqualifySubmission(sub.id)}
                            >
                              {isActing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Ban className="h-3 w-3" />
                              )}
                              <span>Disqualify</span>
                            </Button>
                          )}

                          {sub.state === "DISQUALIFIED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isActing}
                              className="text-xs h-7 gap-1 text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                              onClick={() => handleRestoreSubmission(sub.id)}
                            >
                              {isActing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              <span>Restore</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Lifecycle */}
      {activeTab === "lifecycle" && (
        <div className="space-y-6">
          {transitionError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{transitionError}</span>
            </div>
          )}

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-foreground">
                    Current Lifecycle State
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    State transitions must adhere to the server-side state machine. Illegal transitions are rejected.
                  </CardDescription>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-3 py-1">
                  {event.state}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 border-t border-border/60">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Permitted Next Transitions
              </h4>

              {nextActions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  This event is in a terminal state ({event.state}). No further transitions are available.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nextActions.map((action) => (
                    <div
                      key={action.target}
                      className="border border-border/80 bg-muted/20 p-4 rounded-lg space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-sm text-foreground block">
                          {action.label}
                        </span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {action.desc}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleStateTransition(action.target)}
                        disabled={isTransitioning}
                        className="text-xs gap-1.5 self-start bg-primary"
                      >
                        {isTransitioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        <span>Transition to {action.target}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Participants */}
      {activeTab === "participants" && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Enrolled Participants ({event.memberships.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              All users holding active memberships in this event.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {event.memberships.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">No participants registered yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {event.memberships.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">{m.user.name}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">{m.user.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {m.role}
                      </Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Teams */}
      {activeTab === "teams" && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              Registered Teams ({event.teams.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Active teams competing in this event.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {event.teams.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">No teams created yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {event.teams.map((t) => (
                  <div key={t.id} className="border border-border/80 bg-muted/20 p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {t.members.length} members
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Captain: <span className="text-foreground font-medium">{t.creator.name}</span>
                    </p>
                    {t.track && (
                      <p className="text-xs text-primary/80">Track: {t.track.name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Tracks */}
      {activeTab === "tracks" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Add Competition Track
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trackError && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  {trackError}
                </div>
              )}
              <form onSubmit={handleCreateTrack} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="trackName" className="block text-xs font-medium text-foreground mb-1">
                      Track Name *
                    </label>
                    <input
                      id="trackName"
                      type="text"
                      required
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                      placeholder="e.g. AI & Machine Learning"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="trackDesc" className="block text-xs font-medium text-foreground mb-1">
                      Description (Optional)
                    </label>
                    <input
                      id="trackDesc"
                      type="text"
                      value={trackDesc}
                      onChange={(e) => setTrackDesc(e.target.value)}
                      placeholder="Track challenge theme and requirements"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={isAddingTrack} className="text-xs gap-1.5 bg-primary">
                  {isAddingTrack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Add Track</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Existing Tracks ({event.tracks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {event.tracks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">No tracks configured yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {event.tracks.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{t.name}</span>
                        <span className="text-muted-foreground font-mono text-[10px]">slug: {t.slug}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Prizes */}
      {activeTab === "prizes" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Add Award / Bounty
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prizeError && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  {prizeError}
                </div>
              )}
              <form onSubmit={handleCreatePrize} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="prizeName" className="block text-xs font-medium text-foreground mb-1">
                      Prize Name *
                    </label>
                    <input
                      id="prizeName"
                      type="text"
                      required
                      value={prizeName}
                      onChange={(e) => setPrizeName(e.target.value)}
                      placeholder="e.g. 1st Place Overall"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="prizeValue" className="block text-xs font-medium text-foreground mb-1">
                      Cash Value (USD)
                    </label>
                    <input
                      id="prizeValue"
                      type="number"
                      value={prizeValue}
                      onChange={(e) => setPrizeValue(e.target.value)}
                      placeholder="5000"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {event.tracks.length > 0 && (
                    <div>
                      <label htmlFor="prizeTrack" className="block text-xs font-medium text-foreground mb-1">
                        Track Association
                      </label>
                      <select
                        id="prizeTrack"
                        value={prizeTrackId}
                        onChange={(e) => setPrizeTrackId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- General / All Tracks --</option>
                        {event.tracks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={isAddingPrize} className="text-xs gap-1.5 bg-primary">
                  {isAddingPrize ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Add Prize</span>
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">
                Configured Prizes ({event.prizes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {event.prizes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">No prizes configured yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {event.prizes.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">{p.name}</span>
                        {p.track && (
                          <span className="text-primary/70 text-[10px]">Track: {p.track.name}</span>
                        )}
                      </div>
                      {p.value && (
                        <span className="font-mono text-emerald-400 font-bold">
                          ${Number(p.value).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Judging */}
      {activeTab === "judging" && (
        <div className="space-y-6">
          <div className="flex border-b border-border/60 space-x-2">
            <button
              onClick={() => setJudgingSubTab("progress")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                judgingSubTab === "progress"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Real-time Progress
            </button>
            <button
              onClick={() => setJudgingSubTab("assignments")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                judgingSubTab === "assignments"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Judge Assignment Engine
            </button>
            <button
              onClick={() => setJudgingSubTab("rubrics")}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                judgingSubTab === "rubrics"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Rubrics & Criteria
            </button>
          </div>

          {judgingSubTab === "progress" && (
            <JudgingProgressCard eventId={event.id} />
          )}

          {judgingSubTab === "assignments" && (
            <AssignmentGenerator
              eventId={event.id}
              tracks={event.tracks}
            />
          )}

          {judgingSubTab === "rubrics" && (
            <RubricManager
              eventId={event.id}
              tracks={event.tracks}
              isJudgingOpen={event.state === "JUDGING_OPEN"}
            />
          )}
        </div>
      )}

      {/* Tab: Results & Fairness */}
      {activeTab === "results" && (
        <OrganizerResultsDashboard
          eventId={event.id}
          tracks={event.tracks}
          prizes={event.prizes}
        />
      )}

      {/* Tab: Community & Voting */}
      {activeTab === "community" && (
        <OrganizerCommunityDashboard eventId={event.id} />
      )}

      {/* Tab: Audit Trail & Ledger */}
      {activeTab === "audit" && (
        <EventAuditTrail eventId={event.id} />
      )}
    </div>
  );
}
