import { NextRequest } from "next/server";
import { communityService } from "@/server/services/community.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/voting/results
 * Retrieves community choice voting results and leaderboard.
 * Concealed unless published by organizers or requested by an event organizer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    const results = await communityService.getCommunityResults(
      eventId,
      isOrganizer
    );

    return apiSuccess(results);
  } catch (error) {
    return apiError(error);
  }
}
