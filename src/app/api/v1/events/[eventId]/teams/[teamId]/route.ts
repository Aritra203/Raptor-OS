import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { eventRepository } from "@/server/repositories/event.repository";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toTeamDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/teams/[teamId]
 * Retrieves full details for a specific team.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; teamId: string }> }
) {
  try {
    const { eventId, teamId } = await params;
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError("Event", eventId);
    }

    const team = await prisma.team.findFirst({
      where: {
        eventId: event.id,
        OR: [{ id: teamId }, { slug: teamId }],
      },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!team) {
      throw new NotFoundError("Team", teamId);
    }

    return apiSuccess(toTeamDTO(team));
  } catch (error) {
    return apiError(error);
  }
}
