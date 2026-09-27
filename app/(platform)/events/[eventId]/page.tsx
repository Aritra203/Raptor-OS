import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventService } from "@/server/services/event.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { teamService } from "@/server/services/team.service";
import { RegisterButton } from "@/components/events/register-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar,
  Trophy,
  Layers,
  MapPin,
  Globe,
  Clock,
  ArrowRight,
  Settings,
  Users,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function getTimelineItems(event: {
  state: string;
  registrationStart?: Date | string | null;
  registrationEnd?: Date | string | null;
  submissionsStart?: Date | string | null;
  submissionsEnd?: Date | string | null;
  judgingStart?: Date | string | null;
  judgingEnd?: Date | string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}) {
  const fmt = (d: Date | string | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "TBA";

  const items = [
    {
      label: "Registration Phase",
      date: `${fmt(event.registrationStart)} – ${fmt(event.registrationEnd)}`,
      description: "Participants register, verify profiles, and assemble teams.",
    },
    {
      label: "Submissions Phase",
      date: `${fmt(event.submissionsStart)} – ${fmt(event.submissionsEnd)}`,
      description: "Teams build projects and submit repository/demo links before deadline.",
    },
    {
      label: "Rubric Judging",
      date: `${fmt(event.judgingStart)} – ${fmt(event.judgingEnd)}`,
      description: "Certified judges evaluate projects with score calibration.",
    },
    {
      label: "Results & Awards",
      date: event.state === "RESULTS_PUBLISHED" ? "Published" : "Pending Evaluation",
      description: "Official rankings, bounties, and verifiable certificates announced.",
    },
  ];

  const stateToIdx: Record<string, number> = {
    DRAFT: -1,
    REGISTRATION_OPEN: 0,
    REGISTRATION_CLOSED: 0,
    SUBMISSIONS_OPEN: 1,
    SUBMISSIONS_CLOSED: 1,
    JUDGING_OPEN: 2,
    JUDGING_CLOSED: 2,
    RESULTS_PUBLISHED: 3,
    ARCHIVED: 4,
  };

  const activeIdx = stateToIdx[event.state] ?? -1;

  return items.map((item, i) => ({
    ...item,
    status: (i < activeIdx
      ? "completed"
      : i === activeIdx
      ? "current"
      : "upcoming") as "completed" | "current" | "upcoming",
  }));
}

export default async function EventDetailPage({
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
  const userId = auth?.user.id;

  const userMembership = auth?.user.eventMemberships?.find(
    (m) => (m.eventId === event.id || m.eventId === eventId) && m.status === "ACTIVE"
  );
  const isParticipant = userMembership?.role === "PARTICIPANT";
  const isOrganizer =
    userMembership?.role === "ORGANIZER" || userMembership?.role === "ADMIN";

  const userTeam = userId
    ? await teamService.getUserTeamInEvent(userId, event.id)
    : null;

  const isRegistrationOpen = event.state === "REGISTRATION_OPEN";
  const timelineItems = getTimelineItems(event);

  const totalPrizeValue = (event.prizes ?? []).reduce((sum, p) => {
    return sum + (p.value ? Number(p.value) : 0);
  }, 0);

  return (
    <div className="space-y-8 pb-16">
      {/* ── Event Hero Banner (Devfolio Style) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface-1 via-card/70 to-background p-6 sm:p-10 shadow-2xl">
        {/* Glow */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
          <div className="space-y-4 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={event.state} size="md" />
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 px-2.5 py-1 rounded-full border border-border/50">
                {event.isVirtual ? (
                  <>
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <span>Online Virtual Hackathon</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{event.location || "Venue TBA"}</span>
                  </>
                )}
              </span>
              {totalPrizeValue > 0 && (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>${totalPrizeValue.toLocaleString()} in Prizes</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                {event.name}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
                {event.description || "Self-hosted hackathon on RaptorOS platform."}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span>Timezone: <strong className="text-foreground font-mono">{event.timezone}</strong></span>
              <span>•</span>
              <span>Team capacity: <strong className="text-foreground">{event.minTeamSize}–{event.maxTeamSize} members</strong></span>
            </div>
          </div>

          {/* Quick Action Area */}
          <div className="flex flex-col gap-2.5 shrink-0 lg:w-64 pt-2">
            {event.state === "RESULTS_PUBLISHED" && (
              <Link
                href={`/events/${event.slug || event.id}/results`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-5 py-3 text-sm font-semibold text-amber-400 hover:bg-amber-500/25 transition-all shadow-sm"
              >
                <Trophy className="h-4 w-4" />
                <span>View Final Results</span>
              </Link>
            )}

            {isOrganizer && (
              <Link
                href={`/events/${event.slug || event.id}/manage`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm"
              >
                <Settings className="h-4 w-4" />
                <span>Organizer Console</span>
              </Link>
            )}

            {!auth ? (
              <Link
                href={`/login?redirect=/events/${event.slug || event.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                <span>Sign In to Register</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : isParticipant ? (
              <div className="space-y-2">
                <RegisterButton eventId={event.id} isRegistered={true} />
                {userTeam ? (
                  <Link
                    href={`/events/${event.slug || event.id}/team`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/70 hover:bg-muted/50 px-4 py-2.5 text-xs font-semibold text-foreground transition-colors"
                  >
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>My Team ({userTeam.name})</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link
                    href={`/events/${event.slug || event.id}/team`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/90 hover:bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all shadow-sm"
                  >
                    <span>Form / Join a Team</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : isRegistrationOpen ? (
              <RegisterButton eventId={event.id} isRegistered={false} />
            ) : (
              <div className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/20 border border-border px-4 py-3 rounded-xl">
                <Clock className="h-4 w-4" />
                <span>Registration Closed</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Numbers Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60 pt-6 mt-6">
          <StatCard
            label="Participants"
            value={event._count?.memberships || 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Teams"
            value={event._count?.teams || 0}
            icon={<GitBranch className="h-4 w-4" />}
          />
          <StatCard
            label="Tracks"
            value={event.tracks?.length || 0}
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            label="Awards"
            value={event.prizes?.length || 0}
            icon={<Trophy className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/70 border border-border p-1.5 rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tracks">Tracks ({(event.tracks ?? []).length})</TabsTrigger>
          <TabsTrigger value="prizes">Prizes ({(event.prizes ?? []).length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline & Dates</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl border-border bg-card/60 p-6 space-y-4">
                <h3 className="text-lg font-bold text-foreground">
                  About This Hackathon
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description || "Welcome to the event. Follow the instructions and rubric criteria to compete."}
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 rounded-lg bg-surface-1 border border-border text-foreground font-medium">
                    Team Limit: {event.minTeamSize} to {event.maxTeamSize} members
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-surface-1 border border-border text-foreground font-medium">
                    Submission Format: GitHub Repo + Live Demo
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-surface-1 border border-border text-foreground font-medium">
                    Judging: Multi-Criteria Rubric
                  </span>
                </div>
              </Card>

              {/* Tracks Highlights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Challenge Tracks</span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {(event.tracks ?? []).length} active tracks
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(event.tracks ?? []).map((track) => (
                    <div
                      key={track.id}
                      className="rounded-xl border border-border/80 bg-card/40 p-4 space-y-1.5"
                    >
                      <h4 className="font-semibold text-sm text-foreground">
                        {track.name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {track.description || "General track challenge for this hackathon."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              <Card className="rounded-2xl border-border bg-card/60 p-5 space-y-4">
                <h4 className="text-sm font-bold text-foreground">
                  Event Highlights
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Registration Deadline</span>
                    <span className="font-medium text-foreground">
                      {event.registrationEnd ? new Date(event.registrationEnd).toLocaleDateString() : "TBA"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Submissions Deadline</span>
                    <span className="font-medium text-foreground">
                      {event.submissionsEnd ? new Date(event.submissionsEnd).toLocaleDateString() : "TBA"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Judging Concludes</span>
                    <span className="font-medium text-foreground">
                      {event.judgingEnd ? new Date(event.judgingEnd).toLocaleDateString() : "TBA"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Platform Ledger</span>
                    <span className="font-mono text-primary font-bold">RaptorOS Offline</span>
                  </div>
                </div>
              </Card>

              {userTeam && (
                <Card className="rounded-2xl border-primary/30 bg-primary/5 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-bold text-xs text-foreground">
                      Your Team: {userTeam.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You are registered with team {userTeam.name}. Manage teammates or submit project drafts.
                  </p>
                  <Link
                    href={`/events/${event.slug || event.id}/team`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Open Team Manager</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Tracks */}
        <TabsContent value="tracks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(event.tracks ?? []).map((track) => (
              <Card key={track.id} className="rounded-2xl border-border bg-card/60 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-foreground">
                    {track.name}
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Track
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {track.description || "Official competition track. Submit your team entry to compete for this track's bounty."}
                </p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Prizes */}
        <TabsContent value="prizes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(event.prizes ?? []).map((prize, idx) => (
              <Card key={prize.id} className="rounded-2xl border-border bg-card/60 p-6 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Award #{idx + 1}
                  </span>
                  {prize.value && (
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      ${Number(prize.value).toLocaleString()}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-foreground">
                  {prize.name}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {prize.description || "Verified bounty awarded at the conclusion of rubric judging."}
                </p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 4: Timeline */}
        <TabsContent value="timeline" className="space-y-6">
          <Card className="rounded-2xl border-border bg-card/60 p-6 space-y-6">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Event Governance Timeline</span>
            </h3>
            <div className="space-y-4">
              {timelineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl border border-border/70 bg-surface-2/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <Badge
                        variant="outline"
                        className={
                          item.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                            : item.status === "current"
                            ? "bg-primary/10 text-primary border-primary/30 text-[10px]"
                            : "text-muted-foreground border-border text-[10px]"
                        }
                      >
                        {item.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{item.date}</p>
                    <p className="text-xs text-muted-foreground/90">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
