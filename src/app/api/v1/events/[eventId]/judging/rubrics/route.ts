import { NextRequest } from "next/server";
import { rubricRepository } from "@/server/repositories/rubric.repository";
import { requireAnyEventRole } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/judging/rubrics
 * Retrieves active judging rubrics and evaluation criteria for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireAnyEventRole(eventId, ["JUDGE", "ORGANIZER", "ADMIN"], req);

    const rubrics = await rubricRepository.findRubricsByEvent(eventId);
    const sanitized = rubrics.map((r) => {
      const activeVersion = r.versions.find((v) => v.isActive) || r.versions[0] || null;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        trackId: r.trackId,
        activeVersion: activeVersion
          ? {
              id: activeVersion.id,
              versionNumber: activeVersion.versionNumber,
              isActive: activeVersion.isActive,
              criteria: activeVersion.criteria.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                weight: c.weight.toString(),
                maxScore: c.maxScore.toString(),
                order: c.order,
              })),
            }
          : null,
      };
    });

    return apiSuccess(sanitized);
  } catch (error) {
    return apiError(error);
  }
}
