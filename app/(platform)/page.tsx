import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Scale,
  Trophy,
  ArrowRight,
  WifiOff,
  Sparkles,
  GitBranch,
  Zap,
  Code2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { eventService } from "@/server/services/event.service";
import { TerminalHud } from "@/components/landing/terminal-hud";

export const dynamic = "force-dynamic";

const HACKATHON_LOOP = [
  {
    step: "01",
    label: "ASSEMBLE",
    title: "Team Workspace",
    description: "Form rosters within capacity limits, share 1-click invite links, and assign developer roles.",
    icon: Users,
    tag: "1-4 Hackers",
  },
  {
    step: "02",
    label: "SHIP",
    title: "Proof of Build",
    description: "Submit GitHub repositories, demo links, and video walkthroughs with immutable version locking.",
    icon: Code2,
    tag: "Verified Artifacts",
  },
  {
    step: "03",
    label: "EVALUATE",
    title: "Calibrated Judging",
    description: "Evaluators score via weighted rubrics under double-blind isolation with mathematical z-score normalization.",
    icon: Scale,
    tag: "Fair Placement",
  },
];

const PLATFORM_STATS = [
  { label: "Active Builders", value: "92+", icon: Users },
  { label: "Teams Formed", value: "41", icon: GitBranch },
  { label: "Tracks & Bounties", value: "8", icon: Trophy },
  { label: "Infrastructure", value: "Offline-First", icon: WifiOff },
];

export default async function HomePage() {
  const publicEvents = await eventService.getPublicEvents().catch(() => []);

  return (
    <div className="space-y-16 pb-20 max-w-6xl mx-auto">
      {/* ── Hero Section (Devfolio / ETHGlobal Hacker Atmosphere) ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-surface-1/60 p-6 sm:p-12 lg:p-16 shadow-2xl">
        {/* Cyber grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-cyber opacity-70 pointer-events-none" />

        {/* Ambient radial glows */}
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-8">
          {/* Status Beacon & Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HACKING ACTIVE · DOGFOOD 2026</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground/80 bg-surface-2/80 px-2.5 py-1 rounded-full border border-border/60">
              v0.1.0 · Self-Hostable
            </span>
          </div>

          {/* Punchy Hacker Tagline */}
          <div className="space-y-4 max-w-3xl">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.05]">
              BUILD. SHIP. <br />
              <span className="text-gradient">JUDGE WITH FAIRNESS.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl font-normal">
              RaptorOS is the self-hostable, offline-first operating system for modern hackathons. From team formation to double-blind rubric evaluations and verifiable cryptographic evidence.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] select-none cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>Explore Hackathons</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card/80 hover:bg-surface-2 px-5 py-3 text-sm font-semibold text-foreground transition-all shadow-xs select-none cursor-pointer"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Project Gallery</span>
            </Link>

            <Link
              href="/events/new"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-transparent hover:bg-surface-2/60 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Launch Hackathon</span>
            </Link>
          </div>

          {/* Interactive Live Terminal HUD */}
          <div className="pt-4">
            <TerminalHud />
          </div>
        </div>
      </section>

      {/* ── Live Telemetry Pulse & Metrics Ticker ── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {PLATFORM_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/70 bg-card/60 p-5 space-y-1.5 hover:border-primary/40 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-mono uppercase tracking-wider">{stat.label}</span>
                <Icon className="h-4 w-4 text-primary/80" />
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
                {stat.value}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Featured Hackathons (Devfolio-Grade Cards) ── */}
      {publicEvents.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/60 pb-3">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Active Competitions</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Live hackathons currently open for team registration and project submissions.
              </p>
            </div>
            <Link
              href="/events"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>View All Events ({publicEvents.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicEvents.slice(0, 6).map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug || event.id}`}
                prefetch={true}
                className="group block rounded-2xl border border-border/70 hover:border-primary/50 bg-card/60 hover:bg-card p-5 space-y-4 transition-all duration-200 hover:shadow-xl hover:shadow-primary/5 shadow-xs cursor-pointer select-none active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <StatusBadge status={event.state} size="sm" />
                  <span className="text-[11px] text-muted-foreground/80 font-mono">
                    {event.isVirtual ? "Virtual" : event.location || "In-Person"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {event.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                    {event.description || "Self-hosted hackathon on RaptorOS platform."}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      <strong className="text-foreground">{event._count?.memberships || 0}</strong> builders
                    </span>
                  </div>

                  <span className="font-semibold text-xs text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground">
                    <span>Enter Event</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Minimalist 3-Step Hackathon Loop ── */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[11px] font-mono uppercase tracking-wider">
            Engineered For Hackathons
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            How The Competition Flows
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Zero spreadsheet confusion. Fully automated event governance from start to finish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {HACKATHON_LOOP.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="group relative rounded-2xl border border-border/70 bg-card/50 p-6 space-y-4 hover:border-primary/40 hover:bg-card transition-all duration-200 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-primary/80 bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                    STEP {step.step}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                    {step.tag}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{step.title}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Self-Host / Command CTA ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-surface-1/70 p-8 sm:p-12 text-center space-y-6 shadow-xl">
        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Ready to host your own hackathon?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Deploy RaptorOS on bare metal or internal cloud in under 60 seconds.
          </p>
        </div>

        {/* Quick Shell Command Chip */}
        <div className="inline-flex items-center gap-2 rounded-xl bg-surface-0/80 border border-border/80 px-4 py-2 text-xs font-mono text-foreground/90 shadow-inner">
          <span className="text-emerald-400 select-none">$</span>
          <span className="text-emerald-300">git clone && docker compose up -d --build</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-[0.98] cursor-pointer"
          >
            <span>Launch Event Wizard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 hover:bg-surface-2 px-5 py-2.5 text-xs sm:text-sm font-medium text-foreground transition-colors cursor-pointer"
          >
            <span>Explore Live Events</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
