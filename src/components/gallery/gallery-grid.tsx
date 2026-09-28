"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  GitBranch,
  Video,
  Globe,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { PublicSubmissionDTO } from "@/server/services/gallery.service";

interface GalleryGridProps {
  initialItems: PublicSubmissionDTO[];
  initialPagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  events: Array<{ id: string; name: string; slug: string }>;
  tracks: Array<{ id: string; name: string; slug: string; eventId: string }>;
}

export function GalleryGrid({
  initialItems,
  initialPagination,
  events,
  tracks,
}: GalleryGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = React.useState(searchParams.get("q") || "");
  const [selectedEventId, setSelectedEventId] = React.useState(searchParams.get("eventId") || "");
  const [selectedTrackId, setSelectedTrackId] = React.useState(searchParams.get("trackId") || "");
  const [sortOption, setSortOption] = React.useState(searchParams.get("sort") || "newest");

  // Filter tracks by selected event if any
  const availableTracks = selectedEventId
    ? tracks.filter((t) => t.eventId === selectedEventId)
    : tracks;

  const applyFilters = (overrides: Record<string, string | number | null> = {}) => {
    const params = new URLSearchParams(searchParams.toString());

    const newQuery = overrides.q !== undefined ? overrides.q : searchQuery;
    const newEvent = overrides.eventId !== undefined ? overrides.eventId : selectedEventId;
    const newTrack = overrides.trackId !== undefined ? overrides.trackId : selectedTrackId;
    const newSort = overrides.sort !== undefined ? overrides.sort : sortOption;
    const newPage = overrides.page !== undefined ? overrides.page : 1;

    if (newQuery && String(newQuery).trim()) {
      params.set("q", String(newQuery).trim());
    } else {
      params.delete("q");
    }

    if (newEvent) {
      params.set("eventId", String(newEvent));
    } else {
      params.delete("eventId");
    }

    if (newTrack) {
      params.set("trackId", String(newTrack));
    } else {
      params.delete("trackId");
    }

    if (newSort && newSort !== "newest") {
      params.set("sort", String(newSort));
    } else {
      params.delete("sort");
    }

    if (Number(newPage) > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }

    router.push(`/gallery?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ page: 1 });
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedTrackId(""); // Reset track when event changes
    applyFilters({ eventId: eventId || null, trackId: null, page: 1 });
  };

  const handleTrackChange = (trackId: string) => {
    setSelectedTrackId(trackId);
    applyFilters({ trackId: trackId || null, page: 1 });
  };

  const handleSortChange = (sort: string) => {
    setSortOption(sort);
    applyFilters({ sort, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between p-4 rounded-lg border border-border/80 bg-card/60 shadow-sm">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, description, or team..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Event Filter */}
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Hackathons</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>

          {/* Track Filter */}
          <select
            value={selectedTrackId}
            onChange={(e) => handleTrackChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Tracks</option>
            {availableTracks.map((trk) => (
              <option key={trk.id} value={trk.id}>
                {trk.name}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortOption}
            onChange={(e) => handleSortChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest First</option>
            <option value="title_asc">Title (A – Z)</option>
            <option value="title_desc">Title (Z – A)</option>
            <option value="random">Random Shuffled</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {initialItems.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No Submissions Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No project submissions match your query or filters. Try adjusting your search criteria.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialItems.map((project) => (
            <Card
              key={project.id}
              className="flex flex-col border-border/80 bg-card/60 hover:shadow-md hover:border-border transition-all duration-200"
            >
              <CardHeader className="pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0"
                    >
                      {project.event.name}
                    </Badge>
                    {project.track && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground border-border shrink-0"
                      >
                        {project.track.name}
                      </Badge>
                    )}
                  </div>
                  {project.communityVoteCount !== null && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border-rose-500/20 shrink-0 flex items-center gap-1"
                    >
                      <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                      <span>{project.communityVoteCount}</span>
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                  {project.title}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-medium">
                  Team: {project.team.name}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-between space-y-4 pt-0">
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {project.descriptionExcerpt}
                </p>

                <div className="space-y-3 border-t border-border/60 pt-3">
                  {/* External links */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {project.repositoryUrl && (
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors flex items-center gap-1"
                        title="Repository"
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>Code</span>
                      </a>
                    )}
                    {project.demoUrl && (
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors flex items-center gap-1"
                        title="Demo Video"
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>Demo</span>
                      </a>
                    )}
                    {project.deploymentUrl && (
                      <a
                        href={project.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors flex items-center gap-1"
                        title="Live Deployment"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>Live</span>
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/gallery/${project.id}`}
                    className="w-full inline-flex items-center justify-center rounded-md border border-border bg-muted/40 hover:bg-muted/80 px-4 py-2 text-xs font-medium text-foreground transition-colors"
                  >
                    <span>View Project Details</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {initialPagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>
            Showing page {initialPagination.page} of {initialPagination.totalPages} (
            {initialPagination.totalCount} total submissions)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!initialPagination.hasPrev}
              onClick={() => applyFilters({ page: initialPagination.page - 1 })}
              className="text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!initialPagination.hasNext}
              onClick={() => applyFilters({ page: initialPagination.page + 1 })}
              className="text-xs gap-1"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
