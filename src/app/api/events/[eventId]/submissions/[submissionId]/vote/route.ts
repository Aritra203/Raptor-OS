import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireUser, resolveSessionUser } from "@/server/auth/authorization";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/submissions/[submissionId]/vote
 * Checks if the currently authenticated user has voted for this submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const auth = await resolveSessionUser(req);

    if (!auth) {
      return NextResponse.json({ hasVoted: false, votedAt: null });
    }

    const status = await communityService.getUserVoteStatus(
      eventId,
      submissionId,
      auth.user.id
    );

    return NextResponse.json(status);
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/events/[eventId]/submissions/[submissionId]/vote
 * Casts an active community vote for the specified project.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId, submissionId } = await params;
    const { user } = await requireUser(req);

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const result = await communityService.castVote({
      eventId,
      submissionId,
      voter: user,
      ip,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * DELETE /api/events/[eventId]/submissions/[submissionId]/vote
 * Retracts an existing community vote.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId, submissionId } = await params;
    const { user } = await requireUser(req);

    const result = await communityService.retractVote({
      eventId,
      submissionId,
      voterId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
