import * as React from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { eventService } from "@/server/services/event.service";
import { teamService } from "@/server/services/team.service";
import { registrationService } from "@/server/services/registration.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { TeamManager } from "@/components/teams/team-manager";
import { CreateTeamForm } from "@/components/teams/create-team-form";
import { ArrowLeft, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EventTeamPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const auth = await resolveSessionUser();
  if (!auth) {
    redirect(`/login?redirect=/events/${eventId}/team`);
  }

  let event;
  try {
    event = await eventService.getEventById(eventId);
  } catch {
    notFound();
  }

  const { user } = auth;

  // Check if user is registered in this event
  const registration = await registrationService.getRegistration(user.id, event.id);
  const isRegistered = registration?.status === "ACTIVE";

  if (!isRegistered) {
    return (
      <div className="max-w-2xl mx-auto p-8 space-y-6 text-center">
        <div className="rounded-xl border border-border bg-card/60 p-8 space-y-4">
          <UserCheck className="h-12 w-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">
            Registration Required
          </h2>
          <p className="text-sm text-muted-foreground">
            You must register as a participant in <span className="font-semibold text-foreground">{event.name}</span> before you can form or join a team.
          </p>
          <Link
            href={`/events/${event.slug || event.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Go to Event Registration
          </Link>
        </div>
      </div>
    );
  }

  // Check if user has a team in this event
  const userTeam = await teamService.getUserTeamInEvent(user.id, event.id);

  return (
    <div className="space-y-8 p-8 max-w-5xl mx-auto">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <Link
            href={`/events/${event.slug || event.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {event.name}</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Team Management
          </h1>
        </div>

        {userTeam && (
          <Link
            href={`/dashboard/submissions?eventId=${event.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm self-start sm:self-auto"
          >
            <span>Project Submission</span>
          </Link>
        )}
      </div>

      {userTeam ? (
        <TeamManager team={userTeam} currentUserId={user.id} />
      ) : (
        <CreateTeamForm
          eventId={event.id}
          eventName={event.name}
          tracks={event.tracks.map((t) => ({ id: t.id, name: t.name }))}
        />
      )}
    </div>
  );
}
