import { NextRequest } from "next/server";
import { eventRepository } from "@/server/repositories/event.repository";
import { resolveSessionUser } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError, ForbiddenError } from "@/lib/errors/app-error";
import { toEventDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]
 * Retrieves full details for a single event.
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

    if (event.state === "DRAFT") {
      const auth = await resolveSessionUser(req);
      const membership = auth?.user.eventMemberships?.find(
        (m) => m.eventId === event.id && m.status === "ACTIVE"
      );
      const isOrganizer =
        membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

      if (!isOrganizer) {
        throw new ForbiddenError(
          "Draft events can only be viewed by event organizers or administrators."
        );
      }
    }

    return apiSuccess(toEventDTO(event));
  } catch (error) {
    return apiError(error);
  }
}
