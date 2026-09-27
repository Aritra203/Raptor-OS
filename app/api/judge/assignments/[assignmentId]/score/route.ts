import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { scoringService } from "@/server/services/scoring.service";
import { saveScoreDraftSchema } from "@/lib/validations/judging";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/judge/assignments/[assignmentId]/score
 * Saves or updates a draft score evaluation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { assignmentId } = await params;

    const rawBody = await req.json();
    const validated = saveScoreDraftSchema.parse(rawBody);

    const draft = await scoringService.saveScoreDraft(
      auth.user.id,
      assignmentId,
      validated
    );

    return NextResponse.json({
      data: draft,
      meta: { message: "Draft score saved successfully." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
