import { NextRequest } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireEventRole, resolveSessionUser } from "@/server/auth/authorization";
import { updateVotingConfigSchema } from "@/lib/validations/community";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/voting/config
 * Retrieves community voting configuration.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const config = await communityService.getVotingConfig(eventId);
    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    if (isOrganizer) {
      return apiSuccess(config);
    }

    // Public sanitized config
    return apiSuccess({
      isEnabled: config.isEnabled,
      votingStart: config.votingStart,
      votingEnd: config.votingEnd,
      publicVoteCounts: config.publicVoteCounts,
      resultsPublished: config.resultsPublished,
      allowSelfVoting: config.allowSelfVoting,
      randomizeGalleryOrder: config.randomizeGalleryOrder,
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * PUT /api/v1/events/[eventId]/voting/config
 * Updates community voting configuration (Organizer only).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = updateVotingConfigSchema.parse(body);

    const updated = await communityService.updateVotingConfig(
      eventId,
      user.id,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}
