"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Users,
  Trophy,
  ArrowRight,
  Globe,
  MapPin,
  X,
  Loader2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface EventItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  description: string | null;
  location: string | null;
  isVirtual: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  registrationEnd?: Date | string | null;
  submissionsEnd?: Date | string | null;
  tracks?: Array<{ id: string; name: string }>;
  prizes?: Array<{ id: string; name: string; value?: unknown }>;
  _count?: {
    memberships: number;
    teams: number;
  };
}

interface EventDiscoveryListProps {
  initialEvents: EventItem[];
  currentUserId?: string;
}

export function EventDiscoveryList({ initialEvents }: EventDiscoveryListProps) {
  const router = useRouter();
  const [navigatingId, setNavigatingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [activeState, setActiveState] = React.useState<string>("ALL");

  const handleNavigate = (e: React.MouseEvent, targetUrl: string, eventId: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    setNavigatingId(eventId);
    router.push(targetUrl);
    setTimeout(() => {
      if (window.location.pathname !== targetUrl) {
        window.location.href = targetUrl;
      }
    }, 1200);
  };

  const filteredEvents = React.useMemo(() => {
    return initialEvents.filter((event) => {
      // 1. State filter
      if (activeState !== "ALL" && event.state !== activeState) {
        return false;
      }
      // 2. Query filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(q);
        const matchesDesc = event.description?.toLowerCase().includes(q) ?? false;
        const matchesTrack = event.tracks?.some((t) => t.name.toLowerCase().includes(q)) ?? false;
        if (!matchesName && !matchesDesc && !matchesTrack) {
          return false;
        }
      }
      return true;
    });
  }, [initialEvents, search, activeState]);

  const stateCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: initialEvents.length };
    for (const e of initialEvents) {
      counts[e.state] = (counts[e.state] || 0) + 1;
    }
    return counts;
  }, [initialEvents]);

  return (
    <div className="space-y-6">
      {/* ── Filter Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* State filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveState("ALL")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer border",
              activeState === "ALL"
                ? "bg-primary text-primary-foreground font-semibold border-primary/40 shadow-sm"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            All Hackathons ({stateCounts["ALL"] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveState("REGISTRATION_OPEN")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer border",
              activeState === "REGISTRATION_OPEN"
                ? "bg-emerald-500/20 text-emerald-400 font-semibold border-emerald-500/40 shadow-sm"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            Registration Open ({stateCounts["REGISTRATION_OPEN"] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveState("SUBMISSIONS_OPEN")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer border",
              activeState === "SUBMISSIONS_OPEN"
                ? "bg-sky-500/20 text-sky-400 font-semibold border-sky-500/40 shadow-sm"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            Submissions Active ({stateCounts["SUBMISSIONS_OPEN"] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveState("JUDGING_OPEN")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer border",
              activeState === "JUDGING_OPEN"
                ? "bg-purple-500/20 text-purple-400 font-semibold border-purple-500/40 shadow-sm"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            In Judging ({stateCounts["JUDGING_OPEN"] || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveState("RESULTS_PUBLISHED")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all shrink-0 cursor-pointer border",
              activeState === "RESULTS_PUBLISHED"
                ? "bg-amber-500/20 text-amber-400 font-semibold border-amber-500/40 shadow-sm"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            Results Published ({stateCounts["RESULTS_PUBLISHED"] || 0})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or track..."
            className="w-full rounded-lg border border-border bg-card/80 pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Events Grid ── */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground/50" />}
          title="No Hackathons Match Criteria"
          description={
            search || activeState !== "ALL"
              ? "Try adjusting your search terms or resetting the status filters."
              : "There are currently no public hackathons scheduled."
          }
          action={
            (search || activeState !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveState("ALL");
                }}
                className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Reset Filters
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((event) => {
            const prizesCount = event.prizes?.length || 0;
            const participantsCount = event._count?.memberships || 0;
            const teamsCount = event._count?.teams || 0;

            const targetUrl = `/events/${event.slug || event.id}`;
            const isNavigating = navigatingId === event.id;

            return (
              <Link
                key={event.id}
                href={targetUrl}
                prefetch={true}
                onClick={(e) => handleNavigate(e, targetUrl, event.id)}
                className="group block cursor-pointer select-none active:scale-[0.99] transition-transform"
              >
                <Card
                  className={cn(
                    "flex flex-col h-full rounded-2xl border-border/70 hover:border-primary/50 transition-all duration-200 hover:shadow-xl hover:shadow-primary/10 bg-card/60 hover:bg-card overflow-hidden cursor-pointer",
                    isNavigating && "border-primary/60 ring-2 ring-primary/30"
                  )}
                >
                  {/* Status header */}
                  <div className="p-5 pb-0 flex items-center justify-between">
                    <StatusBadge status={event.state} size="sm" />
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {event.isVirtual ? (
                        <>
                          <Globe className="h-3 w-3 text-primary/70" />
                          <span>Virtual</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-3 w-3 text-primary/70" />
                          <span className="truncate max-w-[100px]">{event.location || "Venue TBA"}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <CardContent className="flex-1 flex flex-col p-5 pt-3 space-y-4">
                    {/* Title & Description */}
                    <div className="space-y-1.5 flex-1">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 font-pixel tracking-wide">
                        {event.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[32px]">
                        {event.description || "Self-hosted hackathon on RaptorOS platform."}
                      </p>
                    </div>

                    {/* Tracks Tags */}
                    {event.tracks && event.tracks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {event.tracks.slice(0, 3).map((track) => (
                          <span
                            key={track.id}
                            className="inline-flex items-center text-[10px] rounded-md bg-muted/40 text-muted-foreground px-2 py-0.5 border border-border/50"
                          >
                            {track.name}
                          </span>
                        ))}
                        {event.tracks.length > 3 && (
                          <span className="text-[10px] text-muted-foreground/60 px-1 py-0.5">
                            +{event.tracks.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stats & Metadata footer */}
                    <div className="space-y-2.5 border-t border-border/50 pt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            <strong className="text-foreground">{participantsCount}</strong> participants · {teamsCount} teams
                          </span>
                        </div>
                        {prizesCount > 0 && (
                          <div className="flex items-center gap-1 text-amber-400 font-medium">
                            <Trophy className="h-3 w-3" />
                            <span>{prizesCount} prizes</span>
                          </div>
                        )}
                      </div>

                      {/* Team size & view action */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-muted-foreground/70">
                          Team size: {event.minTeamSize}–{event.maxTeamSize}
                        </span>
                        <span
                          className={cn(
                            "font-semibold text-xs px-2.5 py-1 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-sm",
                            isNavigating
                              ? "bg-primary text-primary-foreground font-bold ring-2 ring-primary/40 animate-pulse"
                              : "text-primary group-hover:text-primary-foreground group-hover:bg-primary bg-primary/10"
                          )}
                        >
                          {isNavigating ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Opening...</span>
                            </>
                          ) : (
                            <>
                              <span>View Hackathon</span>
                              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
