import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { resolveSessionUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/voting/results
 * Fetches community voting results and leaderboard.
 * Sanitizes and hides data if results are not publicly visible and caller is not organizer.
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

    return NextResponse.json(results);
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
