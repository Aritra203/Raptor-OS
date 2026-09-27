import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionUser } from "@/server/auth/authorization";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { submissionService } from "@/server/services/submission.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { SubmissionForm } from "@/components/submissions/submission-form";
import { SubmissionHistory } from "@/components/submissions/submission-history";
import {
  FileCode,
  Users,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SubmissionsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const auth = await resolveSessionUser();
  if (!auth) {
    redirect("/login?redirect=/dashboard/submissions");
  }

  const { user } = auth;
  const params = await searchParams;

  // Fetch all registered events for this user
  const registrations = await registrationService.listUserRegistrations(user.id);

  if (registrations.length === 0) {
    return (
      <div className="space-y-6 p-8 max-w-4xl mx-auto">
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Project Submissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your project deliverables, drafts, and final hackathon submissions.
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No Event Registrations</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              You must be registered for a hackathon and belong to a team before creating a submission.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span>Explore Active Hackathons</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  let activeEventRegistration = registrations.find((r) => r.event.id === params.eventId);
  let userTeam = null;
  let submission = null;

  if (activeEventRegistration) {
    userTeam = await teamService.getUserTeamInEvent(user.id, activeEventRegistration.event.id);
    if (userTeam) {
      try {
        submission = await submissionService.getSubmissionByTeamId(user.id, userTeam.id);
      } catch {
        submission = null;
      }
    }
  } else {
    for (const reg of registrations) {
      const t = await teamService.getUserTeamInEvent(user.id, reg.event.id);
      if (t) {
        let s = null;
        try {
          s = await submissionService.getSubmissionByTeamId(user.id, t.id);
        } catch {
          s = null;
        }
        if (s) {
          activeEventRegistration = reg;
          userTeam = t;
          submission = s;
          break;
        } else if (!userTeam) {
          activeEventRegistration = reg;
          userTeam = t;
        }
      }
    }

    if (!activeEventRegistration) {
      activeEventRegistration = registrations[0];
      if (activeEventRegistration) {
        userTeam = await teamService.getUserTeamInEvent(user.id, activeEventRegistration.event.id);
      }
    }
  }

  if (!activeEventRegistration) {
    return null;
  }
  const activeEvent = activeEventRegistration.event;

  // Fetch event tracks
  const eventDetails = await eventRepository.findEventById(activeEvent.id);
  const tracks = eventDetails?.tracks || [];

  const isCaptain = userTeam?.members.some(
    (m) => m.userId === user.id && m.role === "LEADER"
  ) ?? false;

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-6 space-y-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Team Submissions
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Prepare, edit, and finalize your hackathon project entries. Submissions are scoped per team and event.
        </p>
      </div>

      {/* Event Selector Tabs if registered for multiple events */}
      {registrations.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {registrations.map((reg) => (
            <Link
              key={reg.id}
              href={`/dashboard/submissions?eventId=${reg.event.id}`}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                reg.event.id === activeEvent.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 hover:bg-muted/80 text-foreground border border-border"
              }`}
            >
              {reg.event.name}
            </Link>
          ))}
        </div>
      )}

      {!userTeam ? (
        <Card className="text-center py-10">
          <CardContent className="space-y-3">
            <Users className="h-10 w-10 text-amber-400/60 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">
              Team Required for Submission
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              You are registered for <strong>{activeEvent.name}</strong>, but you must create or join a team before you can create a project submission.
            </p>
            <Link
              href={`/events/${activeEvent.id}/team`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span>Manage or Join Team</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {submission && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-card/80 border border-border shadow-sm">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Active Team Submission
                </span>
                <h2 className="text-lg font-bold text-foreground mt-0.5">
                  {submission.title}
                </h2>
              </div>
              {isCaptain && (
                <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium w-fit">
                  Team Captain
                </span>
              )}
            </div>
          )}

          {/* Submission Form */}
          <SubmissionForm
            eventId={activeEvent.id}
            teamId={userTeam.id}
            initialSubmission={submission}
            tracks={tracks}
            isCaptain={isCaptain}
            eventState={activeEvent.state}
            submissionsEnd={activeEvent.submissionsEnd ? activeEvent.submissionsEnd.toISOString() : null}
            minTeamSize={activeEvent.minTeamSize}
            currentTeamSize={userTeam.members.length}
          />

          {/* Submission Version History */}
          {submission && submission.versions.length > 0 && (
            <SubmissionHistory versions={submission.versions} />
          )}
        </div>
      )}
    </div>
  );
}
