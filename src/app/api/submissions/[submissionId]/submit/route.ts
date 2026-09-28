import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { submissionService } from "@/server/services/submission.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/submissions/[submissionId]/submit
 * Finalizes project submission, creating an immutable version snapshot.
 * Requires team Captain (LEADER) role and open submission window.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { submissionId } = await params;

    const submission = await submissionService.finalizeSubmission(
      auth.user.id,
      submissionId
    );

    return NextResponse.json({
      data: submission,
      meta: { message: "Project successfully finalized and submitted." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
