import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireEventRole } from "@/server/auth/authorization";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/voting/results/unpublish
 * Atomically unpublishes community voting results hiding counts from public. (Organizer/Admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const config = await communityService.publishCommunityResults(
      eventId,
      user.id,
      false
    );

    return NextResponse.json({
      success: true,
      message: "Community voting results successfully unpublished.",
      config,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
