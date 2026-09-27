import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { scoringService } from "@/server/services/scoring.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/judge/assignments/[assignmentId]
 * Retrieves details for a specific assignment including rubric and existing score draft.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { assignmentId } = await params;

    const evaluation = await scoringService.getAssignmentEvaluation(
      auth.user.id,
      assignmentId
    );

    return NextResponse.json({
      data: evaluation,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
