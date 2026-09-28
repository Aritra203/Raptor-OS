import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveSessionUser } from "@/server/auth/authorization";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { toEventDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events
 * Returns a paginated list of events.
 * Public users see published/active events; authenticated organizers see their draft events.
 */
export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);
    const auth = await resolveSessionUser(req);

    const isGlobalAdminOrOrg =
      auth?.user.eventMemberships?.some(
        (m) => (m.role === "ADMIN" || m.role === "ORGANIZER") && m.status === "ACTIVE"
      ) || false;

    const where = isGlobalAdminOrOrg ? {} : { state: { not: "DRAFT" as const } };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.event.count({ where }),
    ]);

    const dtos = events.map(toEventDTO);
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}
