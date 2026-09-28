import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { judgingService } from "@/server/services/judging.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/judging/progress
 * Retrieves real-time judging progress metrics for the hackathon organizers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const progress = await judgingService.getEventJudgingProgress(auth.user.id, eventId);

    return NextResponse.json({
      data: progress,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
