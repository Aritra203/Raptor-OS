import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eventService } from "@/server/services/event.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { RegisterButton } from "@/components/events/register-button";
import { ArrowLeft, Users, CheckCircle2, Trophy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function EventRegisterPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let event;
  try {
    event = await eventService.getPublicEventBySlug(eventId, true);
  } catch {
    notFound();
  }

  const auth = await resolveSessionUser();
  if (!auth) {
    redirect(`/login?redirect=/events/${event.slug || event.id}/register`);
  }

  const userMembership = auth.user.eventMemberships?.find(
    (m) => (m.eventId === event.id || m.eventId === eventId) && m.status === "ACTIVE"
  );
  const isRegistered = userMembership?.role === "PARTICIPANT";

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      {/* Back button */}
      <Link
        href={`/events/${event.slug || event.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to {event.name}</span>
      </Link>

      <Card className="rounded-3xl border border-border bg-gradient-to-b from-card via-card/80 to-surface-0 p-6 sm:p-8 shadow-xl space-y-6">
        <CardHeader className="p-0 space-y-2">
          <div className="flex items-center justify-between">
            <StatusBadge status={event.state} size="sm" />
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              {event.isVirtual ? "Virtual Event" : event.location || "In-Person"}
            </Badge>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {isRegistered ? "Registration Confirmed" : `Register for ${event.name}`}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {event.description || "Join fellow builders, assemble a team, and create solutions for this hackathon."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-6">
          {/* Rules & Requirements Checklist */}
          <div className="rounded-2xl border border-border/80 bg-surface-1/50 p-4 space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Participant Requirements
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Team capacity: <strong>{event.minTeamSize} to {event.maxTeamSize} members</strong> per project</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Deliverables: Open-source repository + optional live deployment</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Evaluation: Blind peer review with Z-score rubric calibration</span>
              </div>
            </div>
          </div>

          {/* Action Box */}
          <div className="pt-2 flex flex-col gap-3">
            {isRegistered ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 text-xs flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">You are registered as a participant!</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      Next step: Form or join a hackathon team to start building.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <Link
                    href={`/events/${event.slug || event.id}/team`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                  >
                    <Users className="h-4 w-4" />
                    <span>Manage Your Team</span>
                  </Link>
                  <Link
                    href={`/events/${event.slug || event.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <span>View Event Schedule</span>
                  </Link>
                </div>
              </div>
            ) : event.state === "REGISTRATION_OPEN" ? (
              <div className="space-y-3">
                <RegisterButton eventId={event.id} isRegistered={false} />
                <p className="text-[11px] text-muted-foreground text-center">
                  By clicking Register, you agree to the hackathon code of conduct and offline evaluation terms.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-muted/20 border border-border p-4 text-center space-y-2">
                <Clock className="h-5 w-5 text-muted-foreground mx-auto" />
                <p className="text-xs font-semibold text-foreground">
                  Registration is currently closed for this hackathon
                </p>
                <p className="text-[11px] text-muted-foreground">
                  The current stage is {event.state}. You can still view submissions in the gallery.
                </p>
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium pt-1"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Browse Project Gallery</span>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
