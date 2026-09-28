import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { galleryService } from "@/server/services/gallery.service";
import {
  ArrowLeft,
  GitBranch,
  Video,
  Globe,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CommunityVotingWidget } from "@/components/community/community-voting-widget";
import { SubmissionComments } from "@/components/community/submission-comments";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  let project;
  try {
    project = await galleryService.getPublicSubmission(submissionId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto">
      {/* Navigation breadcrumb */}
      <Link
        href="/gallery"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Project Gallery</span>
      </Link>

      {/* Main Project Header */}
      <div className="border-b border-border pb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            {project.event.name}
          </Badge>
          {project.track && (
            <Badge variant="outline" className="text-xs text-muted-foreground border-border">
              Track: {project.track.name}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            <span>{project.state}</span>
          </Badge>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {project.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>Team: <strong className="text-foreground">{project.team.name}</strong></span>
          </div>
          {project.submittedAt && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Submitted {new Date(project.submittedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Project Description */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-foreground">
                About the Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </div>
            </CardContent>
          </Card>

          {/* Submission Comments Section */}
          <SubmissionComments
            eventId={project.event.id}
            submissionId={project.id}
          />
        </div>

        {/* Deliverables & Team Sidebar */}
        <div className="space-y-6">
          {/* Community Choice Voting Widget */}
          <CommunityVotingWidget
            eventId={project.event.id}
            submissionId={project.id}
            initialVoteCount={project.communityVoteCount}
          />
          {/* Deliverables Card */}
          <Card className="border-border bg-card/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Project Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {project.repositoryUrl && (
                <a
                  href={project.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-foreground group"
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <span>Source Code / Repository</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </a>
              )}

              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-foreground group"
                >
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    <span>Demo Video</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </a>
              )}

              {project.deploymentUrl && (
                <a
                  href={project.deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-foreground group"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span>Live Deployment</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </a>
              )}

              {project.documentationUrl && (
                <a
                  href={project.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-xs text-foreground group"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>Documentation</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                </a>
              )}

              {!project.repositoryUrl &&
                !project.demoUrl &&
                !project.deploymentUrl &&
                !project.documentationUrl && (
                  <p className="text-xs text-muted-foreground italic">
                    No external links provided for this project.
                  </p>
                )}
            </CardContent>
          </Card>

          {/* Team Members Card (Safe: Display Names Only) */}
          <Card className="border-border bg-card/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold text-foreground">
                  Team Members ({project.team.memberNames.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60">
                {project.team.memberNames.map((name, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{name}</span>
                    {idx === 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                        Captain
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
