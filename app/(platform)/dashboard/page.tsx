import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionUser } from "@/server/auth/authorization";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { InvitationActions } from "@/components/teams/invitation-actions";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import {
  Calendar,
  Mail,
  ArrowRight,
  Sparkles,
  Users,
  FileCode,
  LayoutDashboard,
  Trophy,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await resolveSessionUser();
  if (!auth) {
    redirect("/login?redirect=/dashboard");
  }

  const { user } = auth;

  const [registrations, pendingInvitations] = await Promise.all([
    registrationService.listUserRegistrations(user.id),
    teamService.listUserPendingInvitations(user.email),
  ]);

  // Pre-resolve user teams for each registered event to avoid async in JSX
  const registrationsWithTeams = await Promise.all(
    registrations.map(async (reg) => {
      const userTeam = await teamService.getUserTeamInEvent(user.id, reg.event.id);
      return {
        ...reg,
        userTeam,
      };
    })
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={`Participant Command Center`}
        description={`Welcome, ${user.name}. Track your team status, submission milestones, and judging progress.`}
        icon={<LayoutDashboard className="h-6 w-6 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/events/new"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/70 hover:bg-surface-2 px-3 py-2 text-xs font-medium text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Host Event</span>
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Discover Events</span>
            </Link>
          </div>
        }
      />

      {/* ── Pending Team Invitations ── */}
      {pendingInvitations.length > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base font-bold text-foreground">
                Pending Team Invitations
              </CardTitle>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                {pendingInvitations.length} new
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              You have been invited to join a hackathon team. Accept to collaborate and submit projects together.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/60">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={inv.team.name} size="sm" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {inv.team.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
                          {inv.team.event.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Invited by {inv.team.creator.name} · Expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <InvitationActions invitationId={inv.id} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Lifecycle & Registered Events ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              My Hackathon Registrations
            </h2>
            <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {registrations.length}
            </span>
          </div>
        </div>

        {registrationsWithTeams.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground/50" />}
            title="No Active Registrations"
            description="You have not enrolled in any hackathons yet. Find a challenge to start building."
            action={
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                <span>Browse All Hackathons</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {registrationsWithTeams.map((reg) => {
              const event = reg.event;
              const userTeam = reg.userTeam;

              // Derive recommended next action
              let nextAction = {
                title: "View Event Overview",
                href: `/events/${event.slug || event.id}`,
                icon: ArrowRight,
                cta: "View Event",
              };

              if (!userTeam && (event.state === "REGISTRATION_OPEN" || event.state === "SUBMISSIONS_OPEN")) {
                nextAction = {
                  title: "Form or Join a Team",
                  href: `/events/${event.slug || event.id}/team`,
                  icon: Users,
                  cta: "Form Team",
                };
              } else if (userTeam && event.state === "SUBMISSIONS_OPEN") {
                nextAction = {
                  title: "Draft Submission Entry",
                  href: `/dashboard/submissions?eventId=${event.id}`,
                  icon: FileCode,
                  cta: "Work on Project",
                };
              } else if (event.state === "RESULTS_PUBLISHED") {
                nextAction = {
                  title: "Check Final Awards",
                  href: `/events/${event.slug || event.id}/results`,
                  icon: Trophy,
                  cta: "View Results",
                };
              }

              return (
                <Card
                  key={reg.id}
                  className="flex flex-col rounded-2xl border-border/70 bg-card/50 hover:bg-card hover:border-primary/40 transition-all duration-200 overflow-hidden shadow-sm"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold line-clamp-1 text-foreground">
                        {event.name}
                      </CardTitle>
                      <StatusBadge status={event.state} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        Role: {reg.role}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col justify-between p-5 pt-0 space-y-4">
                    {/* Status Box */}
                    <div className="space-y-2 border-t border-border/40 pt-3 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          Team Roster
                        </span>
                        {userTeam ? (
                          <span className="font-semibold text-foreground truncate max-w-[140px]">
                            {userTeam.name}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-medium">Not joined</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Allowed Team Size</span>
                        <span className="font-mono text-foreground">
                          {event.minTeamSize}–{event.maxTeamSize} members
                        </span>
                      </div>
                    </div>

                    {/* Next Action Bar */}
                    <div className="rounded-xl border border-border/60 bg-surface-1/40 p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Recommended Next Step:</span>
                      </div>
                      <Link
                        href={nextAction.href}
                        className="flex items-center justify-between gap-2 w-full rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 px-3 py-2 text-xs font-semibold text-primary transition-colors"
                      >
                        <span className="truncate">{nextAction.title}</span>
                        <nextAction.icon className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </div>

                    {/* Footer Links */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <Link
                        href={`/events/${event.slug || event.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-card/70 hover:bg-muted/50 py-2 font-medium text-foreground transition-colors"
                      >
                        Hackathon Details
                      </Link>
                      <Link
                        href={`/events/${event.slug || event.id}/team`}
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-card/70 hover:bg-muted/50 py-2 font-medium text-foreground transition-colors"
                      >
                        {userTeam ? "Manage Team" : "Join Team"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
