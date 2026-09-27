import { NextRequest } from "next/server";
import { eventRepository } from "@/server/repositories/event.repository";
import { prisma } from "@/lib/db/prisma";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toTrackDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/tracks
 * Retrieves the competition tracks for an event.
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

    const tracks = await prisma.track.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
    });
    return apiSuccess(tracks.map(toTrackDTO));
  } catch (error) {
    return apiError(error);
  }
}
