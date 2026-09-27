import * as React from "react";
import { galleryService } from "@/server/services/gallery.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    eventId?: string;
    trackId?: string;
    sort?: "newest" | "title_asc" | "title_desc" | "random";
    seed?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;

  const [galleryData, events] = await Promise.all([
    galleryService.getPublicGallery({
      query: params.q,
      eventId: params.eventId,
      trackId: params.trackId,
      sort: params.sort || "newest",
      seed: params.seed ? Number(params.seed) : 1337,
      page: params.page ? Number(params.page) : 1,
      limit: params.limit ? Number(params.limit) : 50,
    }),
    eventRepository.findPublicEvents(),
  ]);

  // Extract all active tracks across public events for filter dropdowns
  const tracks = events.flatMap((e) =>
    (e.tracks || []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      eventId: e.id,
    }))
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Project Gallery"
        description="Explore innovative projects built by participants across RaptorOS hackathons. Filter by event, track, or keyword."
        icon={<Trophy className="h-6 w-6" />}
      />

      <GalleryGrid
        initialItems={galleryData.items}
        initialPagination={galleryData.pagination}
        events={events.map((e) => ({ id: e.id, name: e.name, slug: e.slug }))}
        tracks={tracks}
      />
    </div>
  );
}
