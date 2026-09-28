import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { submissionService } from "@/server/services/submission.service";
import { eventRepository } from "@/server/repositories/event.repository";
import { submissionRepository } from "@/server/repositories/submission.repository";
import { formatErrorResponse, ForbiddenError, NotFoundError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/submissions/[submissionId]/lock
 * Administratively locks a submission. Requires ORGANIZER or ADMIN role in the event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { submissionId } = await params;

    const submission = await submissionRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new NotFoundError(`Submission with ID '${submissionId}' was not found.`);
    }

    const membership = await eventRepository.findMembership(auth.user.id, submission.eventId);
    if (!membership || (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")) {
      throw new ForbiddenError("Organizer or Admin privileges required to lock submissions.");
    }

    const locked = await submissionService.lockSubmission(auth.user.id, submissionId);

    return NextResponse.json({
      data: locked,
      meta: { message: "Submission successfully locked." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
