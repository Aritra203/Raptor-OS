import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { assignmentService } from "@/server/services/assignment.service";
import { generateAssignmentsSchema } from "@/lib/validations/judging";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/judging/assignments/generate
 * Executes the deterministic balanced judge assignment algorithm.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const rawBody = await req.json().catch(() => ({}));
    const validated = generateAssignmentsSchema.parse(rawBody);

    const report = await assignmentService.generateAssignments(
      auth.user.id,
      eventId,
      validated
    );

    return NextResponse.json(
      {
        data: report,
        meta: {
          message: `Generated ${report.totalAssignmentsCreated} assignments across ${report.totalJudges} judges.`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
