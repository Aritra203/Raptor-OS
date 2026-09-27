import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { scoringService } from "@/server/services/scoring.service";
import { finalizeScoreSchema } from "@/lib/validations/judging";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/judge/assignments/[assignmentId]/score/finalize
 * Finalizes an official evaluation score, computes weighted score, marks assignment completed,
 * and permanently locks the score as immutable historical evidence.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { assignmentId } = await params;

    const rawBody = await req.json();
    const validated = finalizeScoreSchema.parse(rawBody);

    const result = await scoringService.finalizeScore(
      auth.user.id,
      assignmentId,
      validated
    );

    return NextResponse.json({
      data: result,
      meta: {
        message: "Score finalized successfully. Evaluation is locked and recorded as official evidence.",
      },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
