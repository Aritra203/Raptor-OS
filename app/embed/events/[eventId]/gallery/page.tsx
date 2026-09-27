import { notFound } from "next/navigation";
import { galleryService } from "@/server/services/gallery.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { ExternalLink, Github, ThumbsUp, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmbeddedGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ limit?: string; sort?: string; trackId?: string }>;
}) {
  const { eventId } = await params;
  const { limit: rawLimit, trackId } = await searchParams;

  const event = await eventRepository.findEventBySlugOrId(eventId);
  if (!event || event.state === "DRAFT") {
    notFound();
  }

  const limit = Math.min(24, Math.max(1, parseInt(rawLimit || "6", 10) || 6));

  const { items } = await galleryService.getPublicGallery({
    eventId: event.id,
    trackId,
    limit,
    page: 1,
  });

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span>{event.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
              Showcase
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Public Submissions Gallery
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {items.length} {items.length === 1 ? "project" : "projects"}
        </div>
      </div>

      {/* Projects Grid */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-800 rounded-xl">
          No public projects published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((sub) => (
            <div
              key={sub.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1 truncate">
                    <Layers className="w-3 h-3 flex-shrink-0" />
                    {sub.track?.name || "General Track"}
                  </span>

                  {sub.communityVoteCount !== null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      <ThumbsUp className="w-3 h-3" />
                      {sub.communityVoteCount}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white line-clamp-1">
                  {sub.title}
                </h3>
                <p className="text-xs text-slate-400 font-medium mb-2">
                  by {sub.team.name}
                </p>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {sub.descriptionExcerpt}
                </p>
              </div>

              {/* Links */}
              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  {sub.team.memberNames.length} {sub.team.memberNames.length === 1 ? "builder" : "builders"}
                </span>

                <div className="flex items-center gap-2">
                  {sub.repositoryUrl && (
                    <a
                      href={sub.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                      title="Source Code"
                    >
                      <Github className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {sub.demoUrl && (
                    <a
                      href={sub.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 p-1 rounded transition-colors inline-flex items-center gap-1"
                      title="Live Demo"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">Demo</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-6 pt-3 border-t border-slate-900 text-center text-[10px] text-slate-400">
        Hosted on RaptorOS — Offline Hackathon Operating System
      </div>
    </div>
  );
}
