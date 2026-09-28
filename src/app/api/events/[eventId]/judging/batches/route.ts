import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { assignmentService } from "@/server/services/assignment.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/judging/batches
 * Lists all assignment batches generated for this event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const batches = await assignmentService.listAssignmentBatches(auth.user.id, eventId);

    return NextResponse.json({
      data: batches,
      meta: { count: batches.length },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
