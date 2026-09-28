import { NextRequest, NextResponse } from "next/server";
import { galleryService } from "@/server/services/gallery.service";
import { galleryQuerySchema } from "@/lib/validations/submission";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/gallery
 * Public project discovery gallery with search, event/track filtering, sorting, and pagination.
 * Excludes drafts and disqualified projects. Returns safe DTOs without private user data.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawParams = {
      q: url.searchParams.get("q"),
      eventId: url.searchParams.get("eventId"),
      trackId: url.searchParams.get("trackId"),
      sort: url.searchParams.get("sort") || "newest",
      seed: url.searchParams.get("seed") || "1337",
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "12",
    };

    const validated = galleryQuerySchema.parse(rawParams);

    const result = await galleryService.getPublicGallery({
      query: validated.q,
      eventId: validated.eventId,
      trackId: validated.trackId,
      sort: validated.sort,
      seed: validated.seed,
      page: validated.page,
      limit: validated.limit,
    });

    return NextResponse.json({
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
