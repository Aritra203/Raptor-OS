"use client";

import * as React from "react";
import {
  Settings,
  Trophy,
  ShieldAlert,
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OrganizerCommunityDashboardProps {
  eventId: string;
}

interface VotingConfigState {
  id: string;
  isEnabled: boolean;
  votingStart: string | null;
  votingEnd: string | null;
  eligibilityMode: "ALL_AUTHENTICATED" | "EVENT_PARTICIPANTS";
  allowParticipantVotes: boolean;
  allowJudgeVotes: boolean;
  allowOrganizerVotes: boolean;
  allowSelfVoting: boolean;
  publicVoteCounts: boolean;
  resultsPublished: boolean;
  resultsPublishedAt: string | null;
  randomizeGalleryOrder: boolean;
  galleryRandomSeed: number;
}

interface LeaderboardItem {
  rank: number;
  submissionId: string;
  voteCount: number;
}

interface AbuseSignalItem {
  id: string;
  signalType: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  status: "OPEN" | "REVIEWED" | "DISMISSED" | "ACTIONED";
  reviewNotes: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
  submission?: { title: string } | null;
  reviewedBy?: { name: string } | null;
}

interface EventCommentItem {
  id: string;
  content: string;
  moderationStatus: "PUBLISHED" | "HIDDEN" | "REMOVED";
  createdAt: string;
  user: { name: string; email: string };
  submission: { id: string; title: string };
  moderatedBy?: { name: string } | null;
}

export function OrganizerCommunityDashboard({
  eventId,
}: OrganizerCommunityDashboardProps) {
  const [subTab, setSubTab] = React.useState<
    "config" | "results" | "abuse" | "comments"
  >("config");

  // Voting Config State
  const [config, setConfig] = React.useState<VotingConfigState | null>(null);
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);
  const [configSuccess, setConfigSuccess] = React.useState<string | null>(null);
  const [configError, setConfigError] = React.useState<string | null>(null);

  // Results State
  const [results, setResults] = React.useState<{
    isPublished: boolean;
    totalVotes: number | null;
    uniqueVoters: number | null;
    items: LeaderboardItem[];
  } | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);

  // Abuse Signals State
  const [abuseSignals, setAbuseSignals] = React.useState<AbuseSignalItem[]>([]);
  const [abuseFilter, setAbuseFilter] = React.useState<string>("ALL");
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);

  // Event Comments State
  const [comments, setComments] = React.useState<EventCommentItem[]>([]);
  const [commentFilter, setCommentFilter] = React.useState<string>("ALL");
  const [moderatingCommentId, setModeratingCommentId] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);

  const loadAllData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [configRes, resultsRes, abuseRes, commentsRes] = await Promise.all([
        fetch(`/api/events/${eventId}/voting/config`),
        fetch(`/api/events/${eventId}/voting/results`),
        fetch(`/api/events/${eventId}/abuse-signals`),
        fetch(`/api/events/${eventId}/comments`).catch(() => null),
      ]);

      if (configRes.ok) {
        const d = await configRes.json();
        setConfig(d.config);
      }

      if (resultsRes.ok) {
        const d = await resultsRes.json();
        setResults(d);
      }

      if (abuseRes.ok) {
        const d = await abuseRes.json();
        setAbuseSignals(d.signals || []);
      }

      if (commentsRes && commentsRes.ok) {
        const d = await commentsRes.json();
        setComments(d.comments || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSavingConfig(true);
    setConfigSuccess(null);
    setConfigError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/voting/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled: config.isEnabled,
          votingStart: config.votingStart || null,
          votingEnd: config.votingEnd || null,
          eligibilityMode: config.eligibilityMode,
          allowParticipantVotes: config.allowParticipantVotes,
          allowJudgeVotes: config.allowJudgeVotes,
          allowOrganizerVotes: config.allowOrganizerVotes,
          allowSelfVoting: config.allowSelfVoting,
          publicVoteCounts: config.publicVoteCounts,
          randomizeGalleryOrder: config.randomizeGalleryOrder,
          galleryRandomSeed: Number(config.galleryRandomSeed) || 1337,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update voting configuration.");
      }

      setConfig(data.config);
      setConfigSuccess("Voting configuration successfully updated.");
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Publish / Unpublish
  const handleTogglePublish = async (publish: boolean) => {
    const action = publish ? "publish" : "unpublish";
    if (!confirm(`Are you sure you want to ${action} community voting results?`)) {
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/voting/results/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to ${action} results.`);
      }

      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action} results.`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Abuse Signal Review
  const handleReviewSignal = async (
    signalId: string,
    targetStatus: "REVIEWED" | "DISMISSED" | "ACTIONED"
  ) => {
    const notes = prompt(`Enter review notes for setting status to ${targetStatus}:`);
    if (notes === null) return;

    setReviewingId(signalId);
    try {
      const res = await fetch(`/api/events/${eventId}/abuse-signals/${signalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reviewNotes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message || "Failed to update abuse signal.");
      }

      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Review action failed.");
    } finally {
      setReviewingId(null);
    }
  };

  const handleModerateComment = async (
    commentId: string,
    targetStatus: "PUBLISHED" | "HIDDEN" | "REMOVED"
  ) => {
    setModeratingCommentId(commentId);
    try {
      const res = await fetch(
        `/api/events/${eventId}/comments/${commentId}/moderate`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message || "Failed to moderate comment.");
      }

      await loadAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Moderation failed.");
    } finally {
      setModeratingCommentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const filteredAbuseSignals = abuseSignals.filter((s) => {
    if (abuseFilter === "ALL") return true;
    return s.status === abuseFilter;
  });

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex border-b border-border/60 space-x-2">
        <button
          onClick={() => setSubTab("config")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "config"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Voting Configuration</span>
        </button>

        <button
          onClick={() => setSubTab("results")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "results"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>Community Results</span>
        </button>

        <button
          onClick={() => setSubTab("abuse")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "abuse"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Abuse Signals ({abuseSignals.filter((s) => s.status === "OPEN").length})</span>
        </button>

        <button
          onClick={() => setSubTab("comments")}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            subTab === "comments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Comments Moderation ({comments.length})</span>
        </button>
      </div>

      {/* Sub-tab 1: Configuration */}
      {subTab === "config" && config && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          {configError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{configError}</span>
            </div>
          )}

          {configSuccess && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{configSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Toggles */}
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">
                  Voting Activation & Windows
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Control when community voting is open to participants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.isEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, isEnabled: e.target.checked })
                    }
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Enable Community Voting
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Master switch permitting community vote actions.
                    </span>
                  </div>
                </label>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Voting Start Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        config.votingStart
                          ? new Date(config.votingStart).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          votingStart: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Voting End Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={
                        config.votingEnd
                          ? new Date(config.votingEnd).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          votingEnd: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Voter Eligibility & Policies */}
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">
                  Eligibility & Anti-Bias Policies
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Define who can vote and prevent self-voting or exposure bias.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Voter Eligibility Scope
                  </label>
                  <select
                    value={config.eligibilityMode}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        eligibilityMode: e.target
                          .value as "ALL_AUTHENTICATED" | "EVENT_PARTICIPANTS",
                      })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="EVENT_PARTICIPANTS">
                      Event Participants Only (Registered Members)
                    </option>
                    <option value="ALL_AUTHENTICATED">
                      All Authenticated Users (Open Platform Community)
                    </option>
                  </select>
                </div>

                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.allowSelfVoting}
                      onChange={(e) =>
                        setConfig({ ...config, allowSelfVoting: e.target.checked })
                      }
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-medium text-foreground block">
                        Allow Self-Voting
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Default disabled. Prohibits participants from voting for their own team.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.publicVoteCounts}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          publicVoteCounts: e.target.checked,
                        })
                      }
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-medium text-foreground block">
                        Live Public Vote Counts
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        If unchecked, counts remain hidden until official publication.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.randomizeGalleryOrder}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          randomizeGalleryOrder: e.target.checked,
                        })
                      }
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-medium text-foreground block">
                        Deterministic Gallery Randomization
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Shuffles gallery projects evenly to avoid top-of-page exposure bias.
                      </span>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSavingConfig}
              className="text-xs font-semibold bg-primary gap-1.5"
            >
              {isSavingConfig ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Save Configuration</span>
            </Button>
          </div>
        </form>
      )}

      {/* Sub-tab 2: Results & Publication */}
      {subTab === "results" && results && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Votes Cast
                </span>
                <p className="text-2xl font-mono font-bold text-foreground">
                  {results.totalVotes ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Unique Voters
                </span>
                <p className="text-2xl font-mono font-bold text-foreground">
                  {results.uniqueVoters ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/60">
              <CardContent className="p-4 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Public Results State
                </span>
                <div className="pt-0.5">
                  {results.isPublished ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                      Published & Public
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                      Hidden from Public
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">
                  Community Choice Leaderboard
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Deterministic ranking based strictly on active community votes.
                </CardDescription>
              </div>

              <div>
                {results.isPublished ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePublish(false)}
                    disabled={isPublishing}
                    className="text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  >
                    {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
                    <span>Unpublish Results</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleTogglePublish(true)}
                    disabled={isPublishing}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                    <span>Publish Community Results</span>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {results.items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  No community votes have been recorded for this event yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-muted-foreground border-b border-border/60">
                      <tr>
                        <th className="py-2.5 font-semibold">Rank</th>
                        <th className="py-2.5 font-semibold">Submission ID</th>
                        <th className="py-2.5 font-semibold text-right">Votes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {results.items.map((item) => (
                        <tr key={item.submissionId} className="hover:bg-muted/30">
                          <td className="py-2.5 font-mono font-bold text-foreground">
                            #{item.rank}
                          </td>
                          <td className="py-2.5 font-mono text-muted-foreground">
                            {item.submissionId}
                          </td>
                          <td className="py-2.5 font-mono font-bold text-rose-400 text-right">
                            {item.voteCount}
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

      {/* Sub-tab 3: Abuse Signals */}
      {subTab === "abuse" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {["ALL", "OPEN", "REVIEWED", "DISMISSED", "ACTIONED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setAbuseFilter(status)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    abuseFilter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              className="text-xs h-7 gap-1 border-border"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </Button>
          </div>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Suspicious Activity & Review Queue
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Automated heuristics flag suspicious voting activity without automatically deleting votes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredAbuseSignals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  No abuse signals matching filter.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredAbuseSignals.map((signal) => (
                    <div key={signal.id} className="py-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              signal.severity === "HIGH"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {signal.signalType}
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {signal.user ? signal.user.name : "Anonymous/IP"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(signal.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              signal.status === "OPEN"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : signal.status === "REVIEWED"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {signal.status}
                          </Badge>

                          {signal.status === "OPEN" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleReviewSignal(signal.id, "REVIEWED")}
                                disabled={reviewingId === signal.id}
                                className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                              >
                                Mark Reviewed
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewSignal(signal.id, "DISMISSED")}
                                disabled={reviewingId === signal.id}
                                className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded transition-colors"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-foreground/90 leading-relaxed">
                        {signal.description}
                      </p>

                      {signal.reviewNotes && (
                        <div className="rounded bg-muted/30 p-2 text-[11px] text-muted-foreground">
                          <strong>Review Notes:</strong> {signal.reviewNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sub-tab 4: Comments Moderation */}
      {subTab === "comments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground mr-1">Filter:</span>
              {["ALL", "PUBLISHED", "HIDDEN", "REMOVED"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setCommentFilter(status)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    commentFilter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              className="text-xs h-7 gap-1 border-border"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </Button>
          </div>

          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Submission Comments Queue
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Review and moderate public submission comments across all project entries.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {comments.filter(
                (c) => commentFilter === "ALL" || c.moderationStatus === commentFilter
              ).length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-6 text-center">
                  No comments matching filter.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {comments
                    .filter(
                      (c) =>
                        commentFilter === "ALL" ||
                        c.moderationStatus === commentFilter
                    )
                    .map((comment) => (
                      <div key={comment.id} className="py-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {comment.user.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              on project: <strong>{comment.submission.title}</strong>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                comment.moderationStatus === "PUBLISHED"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : comment.moderationStatus === "HIDDEN"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              }`}
                            >
                              {comment.moderationStatus}
                            </Badge>

                            <div className="flex items-center gap-1">
                              {comment.moderationStatus !== "PUBLISHED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleModerateComment(comment.id, "PUBLISHED")
                                  }
                                  disabled={moderatingCommentId === comment.id}
                                  className="text-[10px] text-muted-foreground hover:text-emerald-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border transition-colors"
                                >
                                  <Eye className="h-2.5 w-2.5" />
                                  <span>Publish</span>
                                </button>
                              )}

                              {comment.moderationStatus !== "HIDDEN" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleModerateComment(comment.id, "HIDDEN")
                                  }
                                  disabled={moderatingCommentId === comment.id}
                                  className="text-[10px] text-muted-foreground hover:text-amber-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border transition-colors"
                                >
                                  <EyeOff className="h-2.5 w-2.5" />
                                  <span>Hide</span>
                                </button>
                              )}

                              {comment.moderationStatus !== "REMOVED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleModerateComment(comment.id, "REMOVED")
                                  }
                                  disabled={moderatingCommentId === comment.id}
                                  className="text-[10px] text-destructive hover:bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/30 transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {comment.content}
                        </p>
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
