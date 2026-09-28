import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { submissionService } from "@/server/services/submission.service";
import { updateSubmissionSchema } from "@/lib/validations/submission";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/submissions/[submissionId]
 * Retrieves full details of a submission for authorized team members or organizers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { submissionId } = await params;

    const submission = await submissionService.getSubmissionForUser(
      auth.user.id,
      submissionId
    );

    return NextResponse.json({ data: submission });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * PATCH /api/submissions/[submissionId]
 * Edits draft submission fields before final submission.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { submissionId } = await params;

    const rawBody = await req.json();
    const validated = updateSubmissionSchema.parse(rawBody);

    const submission = await submissionService.updateDraft(
      auth.user.id,
      submissionId,
      validated
    );

    return NextResponse.json({
      data: submission,
      meta: { message: "Submission draft updated successfully." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
