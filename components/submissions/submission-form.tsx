"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileCode,
  Save,
  Send,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  GitBranch,
  Video,
  Globe,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { SubmissionWithDetails } from "@/server/repositories/submission.repository";

interface SubmissionFormProps {
  eventId: string;
  teamId: string;
  initialSubmission: SubmissionWithDetails | null;
  tracks: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  isCaptain: boolean;
  eventState: string;
  submissionsEnd: string | null;
  minTeamSize: number;
  currentTeamSize: number;
}

export function SubmissionForm({
  eventId,
  teamId,
  initialSubmission,
  tracks,
  isCaptain,
  eventState,
  submissionsEnd,
  minTeamSize,
  currentTeamSize,
}: SubmissionFormProps) {
  const router = useRouter();

  const [title, setTitle] = React.useState(initialSubmission?.title || "");
  const [description, setDescription] = React.useState(initialSubmission?.description || "");
  const [trackId, setTrackId] = React.useState(initialSubmission?.trackId || "");
  const [repositoryUrl, setRepositoryUrl] = React.useState(initialSubmission?.repositoryUrl || "");
  const [demoUrl, setDemoUrl] = React.useState(initialSubmission?.demoUrl || "");
  const [deploymentUrl, setDeploymentUrl] = React.useState(initialSubmission?.deploymentUrl || "");
  const [documentationUrl, setDocumentationUrl] = React.useState(
    initialSubmission?.documentationUrl || ""
  );

  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const submissionState = initialSubmission?.state || "UNCREATED";
  const isLocked = submissionState === "LOCKED" || submissionState === "DISQUALIFIED";
  const canEdit = !isLocked && eventState === "SUBMISSIONS_OPEN";
  const meetsMinTeamSize = currentTeamSize >= minTeamSize;

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!initialSubmission) {
        // Create new draft
        const res = await fetch(`/api/events/${eventId}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            trackId: trackId || null,
            title,
            description,
            repositoryUrl: repositoryUrl || null,
            demoUrl: demoUrl || null,
            deploymentUrl: deploymentUrl || null,
            documentationUrl: documentationUrl || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Failed to create draft.");
        setSuccessMessage("Draft submission created successfully!");
      } else {
        // Update draft
        const res = await fetch(`/api/submissions/${initialSubmission.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: trackId || null,
            title,
            description,
            repositoryUrl: repositoryUrl || null,
            demoUrl: demoUrl || null,
            deploymentUrl: deploymentUrl || null,
            documentationUrl: documentationUrl || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Failed to update draft.");
        setSuccessMessage("Draft changes saved successfully.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!initialSubmission) return;

    if (
      !confirm(
        "Are you ready to submit your project? Once submitted, it will be marked as final. You can still revert to draft before the deadline."
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/submissions/${initialSubmission.id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Submission finalization failed.");

      setSuccessMessage("Project finalized and submitted successfully! It is now eligible for evaluation and public gallery.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Final submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* State & Deadline Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border/80 bg-card/60 shadow-sm">
        <div className="flex items-center gap-3">
          <FileCode className="h-5 w-5 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">Project Submission Status</h3>
              <Badge
                variant="outline"
                className={
                  submissionState === "SUBMITTED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : submissionState === "LOCKED"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    : submissionState === "DISQUALIFIED"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }
              >
                {submissionState}
              </Badge>
              {initialSubmission && (submissionState === "SUBMITTED" || submissionState === "LOCKED") && (
                <Link
                  href={`/gallery/${initialSubmission.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>View in Gallery</span>
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eventState !== "SUBMISSIONS_OPEN"
                ? `Submissions are currently ${eventState.replace(/_/g, " ")}.`
                : submissionsEnd
                ? `Deadline: ${new Date(submissionsEnd).toLocaleString()}`
                : "Submissions open."}
            </p>
          </div>
        </div>

        {!meetsMinTeamSize && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Team needs at least {minTeamSize} members to submit (currently {currentTeamSize}).
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSaveDraft} className="space-y-6">
        <Card className="border-border bg-card/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold text-foreground">
              Project Information
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Provide essential details about your hackathon entry. All fields can be saved as a draft prior to final submission.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="subTitle" className="block text-xs font-medium text-foreground">
                  Project Title *
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {title.length} / 150
                </span>
              </div>
              <input
                id="subTitle"
                type="text"
                required
                disabled={!canEdit}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. RaptorMesh Offline Protocol"
                maxLength={150}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>

            {/* Track Selection */}
            <div>
              <label htmlFor="subTrack" className="block text-xs font-medium text-foreground mb-1">
                Competition Track (Optional)
              </label>
              <select
                id="subTrack"
                disabled={!canEdit}
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                <option value="">General Track / Open Competition</option>
                {tracks
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="subDesc" className="block text-xs font-medium text-foreground">
                  Project Description *
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {description.length} / 10,000
                </span>
              </div>
              <textarea
                id="subDesc"
                required
                rows={5}
                disabled={!canEdit}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail what problem your project solves, architectural choices, offline-first design, and tech stack used..."
                maxLength={10000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>
          </CardContent>
        </Card>

        {/* Links and Deliverables Card */}
        <Card className="border-border bg-card/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold text-foreground">
              Deliverables & External Links
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Add links to your source code repository, video demonstration, or deployed live artifact.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Repository URL */}
              <div>
                <label htmlFor="subRepo" className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Repository URL</span>
                </label>
                <input
                  id="subRepo"
                  type="url"
                  disabled={!canEdit}
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-60"
                />
              </div>

              {/* Demo URL */}
              <div>
                <label htmlFor="subDemo" className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Demo Video / Walkthrough</span>
                </label>
                <input
                  id="subDemo"
                  type="url"
                  disabled={!canEdit}
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-60"
                />
              </div>

              {/* Live Deployment */}
              <div>
                <label htmlFor="subDeploy" className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Live Deployment URL</span>
                </label>
                <input
                  id="subDeploy"
                  type="url"
                  disabled={!canEdit}
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                  placeholder="https://app.example.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-60"
                />
              </div>

              {/* Documentation */}
              <div>
                <label htmlFor="subDoc" className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Documentation URL</span>
                </label>
                <input
                  id="subDoc"
                  type="url"
                  disabled={!canEdit}
                  value={documentationUrl}
                  onChange={(e) => setDocumentationUrl(e.target.value)}
                  placeholder="https://docs.example.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-60"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {initialSubmission && (
            <span className="text-xs text-muted-foreground">
              Version {initialSubmission.versions[0]?.versionNumber || 1} • Saved at{" "}
              {new Date(initialSubmission.updatedAt).toLocaleTimeString()}
            </span>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {canEdit && (
              <Button
                type="submit"
                disabled={isSaving || isSubmitting}
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{initialSubmission ? "Save Draft" : "Create Draft"}</span>
              </Button>
            )}

            {canEdit && isCaptain && initialSubmission && submissionState === "DRAFT" && (
              <Button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSaving || isSubmitting || !meetsMinTeamSize}
                size="sm"
                className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Submit Final Project</span>
              </Button>
            )}

            {isLocked && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md border border-border">
                <Lock className="h-3.5 w-3.5" />
                <span>Locked for Evaluation</span>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
