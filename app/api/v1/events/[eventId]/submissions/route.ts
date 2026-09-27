import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { eventRepository } from "@/server/repositories/event.repository";
import { resolveSessionUser } from "@/server/auth/authorization";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toSubmissionDTO } from "@/server/dto/api-v1.dto";
import type { SubmissionState, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/submissions
 * Retrieves a paginated list of submissions for an event.
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
    const requestedState = req.nextUrl.searchParams.get("state") as SubmissionState | null;

    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === event.id && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    const where: Prisma.SubmissionWhereInput = {
      eventId: event.id,
      ...(trackId ? { trackId } : {}),
      ...(isOrganizer
        ? requestedState
          ? { state: requestedState }
          : {}
        : { state: { in: ["SUBMITTED", "LOCKED"] } }),
    };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          team: { select: { name: true } },
          track: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      }),
      prisma.submission.count({ where }),
    ]);

    const dtos = submissions.map((s) => toSubmissionDTO(s, isOrganizer));
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}
