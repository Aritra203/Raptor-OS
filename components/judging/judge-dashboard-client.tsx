"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scale,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export interface AssignmentItem {
  id: string;
  status: string;
  createdAt: Date | string;
  eventId: string;
  event: { id: string; name: string; state: string; [key: string]: unknown };
  submission: {
    id: string;
    title: string;
    description: string;
    team: { id: string; name: string };
    track?: { id: string; name: string } | null;
  };
}

export interface JudgeDashboardData {
  stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
  };
  events: Array<{
    event: { id: string; name: string; state: string; [key: string]: unknown };
    assignments: AssignmentItem[];
  }>;
  assignments: AssignmentItem[];
}

interface JudgeDashboardClientProps {
  initialData: JudgeDashboardData;
  userName: string;
  userEmail: string;
}

export function JudgeDashboardClient({
  initialData,
  userName,
  userEmail,
}: JudgeDashboardClientProps) {
  const [selectedEventId, setSelectedEventId] = React.useState<string>("all");
  const { stats, events, assignments } = initialData;

  const filteredAssignments =
    selectedEventId === "all"
      ? assignments
      : assignments.filter((a) => a.eventId === selectedEventId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Judge Portal"
        description={`Welcome, ${userName}. Review and evaluate assigned hackathon submissions using calibrated rubric criteria.`}
        icon={<Scale className="h-6 w-6 text-primary" />}
        actions={
          events.length > 1 ? (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Events ({assignments.length})</option>
                {events.map((e) => (
                  <option key={e.event.id} value={e.event.id}>
                    {e.event.name} ({e.assignments.length})
                  </option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      {assignments.length > 0 ? (
        <>
          {/* Progress & Stats Bar */}
          <div className="space-y-4">
            <Progress
              value={stats.completed}
              max={stats.total}
              label={`${stats.completed} of ${stats.total} evaluations completed`}
              showValue
              size="md"
              variant={stats.completionRate === 100 ? "success" : "default"}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Assigned" value={stats.total} />
              <StatCard label="Completed" value={stats.completed} variant="success" />
              <StatCard label="In Progress" value={stats.inProgress} variant="warning" />
              <StatCard label="Pending" value={stats.pending} />
            </div>
          </div>

          {/* Assignments List */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Assigned Submissions ({filteredAssignments.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Review each submission thoroughly. Finalized scores are cryptographically recorded.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {filteredAssignments.map((assignment) => {
                  const sub = assignment.submission;
                  const isCompleted = assignment.status === "COMPLETED";
                  const isInProgress = assignment.status === "IN_PROGRESS";
                  const isJudgingOpen = assignment.event.state === "JUDGING_OPEN";

                  return (
                    <div
                      key={assignment.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{sub.title}</span>
                          {sub.track && (
                            <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                              {sub.track.name}
                            </span>
                          )}
                          {isCompleted ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Finalized
                            </Badge>
                          ) : isInProgress ? (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] gap-1">
                              <Clock className="h-3 w-3" /> In Progress
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Pending Evaluation
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-2xl leading-relaxed">
                          {sub.description}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Team: <strong className="text-foreground">{sub.team.name}</strong>
                          </span>
                          <span>·</span>
                          <span>{assignment.event.name}</span>
                        </div>
                      </div>

                      <Link
                        href={`/judge/${assignment.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-9 px-4 text-xs gap-1.5 transition-all shadow-sm shrink-0 active:scale-[0.98]"
                      >
                        {isCompleted ? "Review Score" : isJudgingOpen ? "Score Project" : "View Submission"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Authenticated but no assignments yet */
        <Card className="border-border bg-card/60 p-8 sm:p-12 text-center rounded-2xl shadow-sm">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto">
              <Scale className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                No Evaluation Assignments Yet
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You are signed in as <strong className="text-foreground">{userName}</strong> ({userEmail}). Once event organizers assign submissions to your review queue, they will appear here automatically.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground transition-colors shadow-xs"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
              >
                <span>Browse Hackathons</span>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
