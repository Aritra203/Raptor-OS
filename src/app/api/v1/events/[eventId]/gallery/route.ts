import { NextRequest } from "next/server";
import { galleryService } from "@/server/services/gallery.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { parsePaginationParams } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/gallery
 * Public gallery project showcase with deterministic seeded randomization and pagination.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError("Event", eventId);
    }

    const { page, limit } = parsePaginationParams(req.nextUrl.searchParams);
    const search = req.nextUrl.searchParams.get("search") || undefined;
    const trackId = req.nextUrl.searchParams.get("trackId") || undefined;

    const result = await galleryService.getPublicGallery({
      eventId: event.id,
      search,
      trackId,
      page,
      limit,
    });

    return apiSuccess(result.items, 200, {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.totalCount,
      totalPages: result.pagination.totalPages,
      hasNext: result.pagination.hasNext,
      hasPrev: result.pagination.hasPrev,
    });
  } catch (error) {
    return apiError(error);
  }
}
