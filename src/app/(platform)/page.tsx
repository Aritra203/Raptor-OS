import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
import { CyberMeshBackground } from "@/components/ui/cyber-mesh-background";

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
    <div className="space-y-16 pb-20 max-w-6xl mx-auto w-full min-w-0">
      {/* ── Hero Section (Classic Retro Studio / Hacker Atmosphere) ── */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-8 md:p-10 shadow-sm w-full min-w-0">
        {/* Animated 3D Cybernetic Mesh Wave & Radar Sweep */}
        <CyberMeshBackground />

        {/* Ambient raptor logo mascot in hero corner - clearly visible in light and dark modes */}
        <div className="absolute top-2 sm:top-4 right-0 sm:right-4 md:right-8 w-56 h-56 sm:w-72 sm:h-72 md:w-[320px] md:h-[320px] lg:w-[380px] lg:h-[380px] opacity-35 sm:opacity-85 md:opacity-95 dark:opacity-30 dark:sm:opacity-45 dark:md:opacity-55 pointer-events-none select-none transition-all">
          <Image
            src="/logo-icon.png"
            alt="RaptorOS Emblem"
            fill
            sizes="(max-width: 768px) 256px, 384px"
            className="object-contain filter drop-shadow-[0_10px_25px_rgba(14,165,233,0.22)] dark:drop-shadow-[0_0_30px_rgba(14,165,233,0.35)]"
            priority
          />
        </div>

        <div className="relative z-10 space-y-6 max-w-4xl w-full min-w-0">
          {/* Status Beacon & Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 font-mono uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>HACKING ACTIVE · DOGFOOD 2026</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
              v0.1.0 · Self-Hostable
            </span>
          </div>

          {/* Punchy Hacker Tagline - Scaled for Laptop and Mobile legibility */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight text-foreground font-pixel leading-snug">
              BUILD. SHIP. <br />
              <span className="text-gradient">
                JUDGE WITH FAIRNESS.
              </span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
              RaptorOS is the self-hostable, offline-first operating system for modern hackathons. From team formation to double-blind rubric evaluations and verifiable cryptographic evidence.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98] select-none cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400 dark:text-amber-500" />
              <span>Explore Hackathons</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors select-none cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>Project Gallery</span>
            </Link>

            <Link
              href="/events/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-colors select-none cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Launch Hackathon</span>
            </Link>
          </div>

          {/* Interactive Live Terminal HUD */}
          <div className="pt-2">
            <TerminalHud />
          </div>
        </div>
      </section>

      {/* ── Live Telemetry Pulse & Metrics Ticker ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
        {PLATFORM_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-4 space-y-1 hover:border-primary/40 transition-colors shadow-xs min-w-0"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-silkscreen uppercase tracking-wider truncate">{stat.label}</span>
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-pixel tracking-wide text-foreground truncate">
                {stat.value}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Featured Hackathons (Classic Developer Cards) ── */}
      {publicEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border pb-3">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2 font-pixel">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Active Competitions</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Live hackathons currently open for team registration and project submissions.
              </p>
            </div>
            <Link
              href="/events"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>View All Events ({publicEvents.length})</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicEvents.slice(0, 6).map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug || event.id}`}
                prefetch={true}
                className="group block rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/20 p-5 space-y-3 transition-all duration-150 shadow-xs cursor-pointer select-none"
              >
                <div className="flex items-center justify-between">
                  <StatusBadge status={event.state} size="sm" />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {event.isVirtual ? "Virtual" : event.location || "In-Person"}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 font-pixel">
                    {event.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                    {event.description || "Self-hosted hackathon on RaptorOS platform."}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      <strong className="text-foreground">{event._count?.memberships || 0}</strong> builders
                    </span>
                  </div>

                  <span className="font-semibold text-[11px] text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                    <span>Enter</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Minimalist 3-Step Hackathon Loop ── */}
      <section className="space-y-5">
        <div className="text-center space-y-1.5 max-w-xl mx-auto">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs font-medium">
            Engineered For Hackathons
          </Badge>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-pixel">
            How The Competition Flows
          </h2>
          <p className="text-xs text-muted-foreground">
            Zero spreadsheet confusion. Fully automated event governance from start to finish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full min-w-0">
          {HACKATHON_LOOP.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="group relative rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 hover:border-primary/40 hover:bg-muted/20 transition-all shadow-xs min-w-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    STEP {step.step}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border">
                    {step.tag}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-pixel">
                    <Icon className="h-3.5 w-3.5 text-primary" />
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
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-pixel">
            Ready to host your own hackathon?
          </h2>
          <p className="text-xs text-muted-foreground">
            Deploy RaptorOS on bare metal or internal cloud in under 60 seconds.
          </p>
        </div>

        {/* Quick Shell Command Chip */}
        <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-muted/60 border border-border px-3.5 py-1.5 text-[11px] sm:text-xs font-mono text-foreground shadow-xs overflow-x-auto scrollbar-none">
          <span className="text-primary font-bold select-none shrink-0">$</span>
          <span>git clone && docker compose up -d --build</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <span>Launch Event Wizard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground transition-colors cursor-pointer"
          >
            <span>Explore Live Events</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
