import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireEventRole } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { membership } = await requireEventRole(eventId, "ORGANIZER", req);

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);
    const actionFilter = url.searchParams.get("action");

    const whereClause: Record<string, unknown> = {
      OR: [{ eventId: membership.eventId }, { eventId: null }],
    };

    if (actionFilter) {
      whereClause.action = { contains: actionFilter, mode: "insensitive" };
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    // Collect distinct actor IDs to enrich logs with user names
    const actorIds = Array.from(
      new Set(logs.map((l) => l.actorId).filter((id): id is string => Boolean(id)))
    );

    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });

    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const enrichedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.timestamp.toISOString(),
      timestamp: log.timestamp.toISOString(),
      actor: log.actorId ? actorMap.get(log.actorId) || { id: log.actorId, name: "Unknown User", email: "" } : null,
    }));

    return apiSuccess({
      logs: enrichedLogs,
      total: enrichedLogs.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
