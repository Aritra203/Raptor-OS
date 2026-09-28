import * as React from "react";
import Link from "next/link";
import { resolveSessionUser } from "@/server/auth/authorization";
import { judgingService } from "@/server/services/judging.service";
import { JudgeDashboardClient } from "@/components/judging/judge-dashboard-client";
import {
  Scale,
  ShieldCheck,
  FileCheck2,
  Cpu,
  Lock,
  ArrowRight,
  Trophy,
  LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function JudgePortalPage() {
  const auth = await resolveSessionUser();

  // If user is authenticated, resolve their judging dashboard directly
  if (auth) {
    const dashboard = await judgingService.getJudgeDashboard(auth.user.id);
    return (
      <JudgeDashboardClient
        initialData={dashboard}
        userName={auth.user.name}
        userEmail={auth.user.email}
      />
    );
  }

  // If unauthenticated: Render an inspiring, production-grade Judge Portal Landing Gate
  return (
    <div className="space-y-10 pb-16 max-w-5xl mx-auto">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface-1 via-card/70 to-background p-8 sm:p-12 shadow-2xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              <span>Official Evaluator Command</span>
            </Badge>
            <span className="text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full border border-border/50">
              Double-Blind Peer Review
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Judge Portal & Evaluation Suite
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              The RaptorOS Judge Portal provides calibrated rubric scoring, peer-isolated evaluation sheets, and verifiable mathematical normalization for hackathon submissions.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/login?redirect=/judge"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In as Judge</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/gallery"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/70 hover:bg-muted/50 px-5 py-3 text-sm font-semibold text-foreground transition-all shadow-xs"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Explore Public Submissions</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Core Evaluation Architecture ── */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Evaluation Architecture & Governance
          </h2>
          <p className="text-xs text-muted-foreground">
            How RaptorOS ensures fair, tamper-evident scoring across all competitions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border/80 bg-card/50 p-5 space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Double-Blind Isolation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Evaluations are strictly peer-isolated. Judges cannot view scores submitted by other evaluators until judging closes.
            </p>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-card/50 p-5 space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileCheck2 className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Rubric Standardization
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configurable multi-criteria rubrics with weighted factors across technical depth, innovation, and design quality.
            </p>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-card/50 p-5 space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Cpu className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Z-Score Normalization
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mathematical normalization algorithms eliminate judge bias and neutralize differences between lenient and strict scorers.
            </p>
          </Card>

          <Card className="rounded-2xl border-border/80 bg-card/50 p-5 space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Cryptographic Integrity
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Finalized evaluations are immutable and signed into the event audit trail, generating verifiable winner evidence.
            </p>
          </Card>
        </div>
      </div>

      {/* ── Judge Onboarding Notice ── */}
      <Card className="rounded-2xl border-primary/30 bg-primary/5 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Judge Onboarding
            </span>
            <h3 className="text-base font-bold text-foreground">
              Are you an assigned hackathon judge?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sign in using the exact email address where your organizer invitation was sent. Once authenticated, your evaluation sheets and assigned project submissions will populate automatically.
            </p>
          </div>

          <Link
            href="/login?redirect=/judge"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0 active:scale-[0.98]"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
