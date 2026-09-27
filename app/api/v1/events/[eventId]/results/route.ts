import { NextRequest } from "next/server";
import { resultsService } from "@/server/services/results.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/results
 * Retrieves published official competition results and rankings.
 * Never exposes private judge identities or internal calibration scores.
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

    const results = await resultsService.getPublicResults(event.id);
    return apiSuccess(results);
  } catch (error) {
    return apiError(error);
  }
}
