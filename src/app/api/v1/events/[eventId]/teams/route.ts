import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { eventRepository } from "@/server/repositories/event.repository";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toTeamDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/teams
 * Retrieves a paginated list of teams participating in an event.
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

    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);
    const trackId = req.nextUrl.searchParams.get("trackId") || undefined;

    const where = {
      eventId: event.id,
      ...(trackId ? { trackId } : {}),
    };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { members: true } },
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.team.count({ where }),
    ]);

    const dtos = teams.map((t) => toTeamDTO(t));
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}
