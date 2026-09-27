import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { assignmentService } from "@/server/services/assignment.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/judging/assignments
 * Lists all judge assignments for the hackathon event with optional filters.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId") || undefined;
    const judgeId = searchParams.get("judgeId") || undefined;

    const assignments = await assignmentService.listEventAssignments(
      auth.user.id,
      eventId,
      { submissionId, judgeId }
    );

    return NextResponse.json({
      data: assignments,
      meta: { count: assignments.length },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/events/[eventId]/judging/assignments
 * Revokes an existing assignment by assignmentId.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    await params;

    const { searchParams } = new URL(req.url);
    let assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      const body = await req.json().catch(() => ({}));
      assignmentId = body.assignmentId;
    }

    if (!assignmentId) {
      return NextResponse.json(
        { error: { message: "assignmentId is required to revoke an assignment." } },
        { status: 400 }
      );
    }

    await assignmentService.revokeAssignment(auth.user.id, assignmentId);

    return NextResponse.json({
      meta: { message: "Assignment revoked successfully." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
