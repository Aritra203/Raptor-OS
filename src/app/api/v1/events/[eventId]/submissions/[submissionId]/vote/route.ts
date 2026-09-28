import { NextRequest } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireUser, resolveSessionUser } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/submissions/[submissionId]/vote
 * Checks if the current user has cast a vote for this submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const auth = await resolveSessionUser(req);
    if (!auth) {
      return apiSuccess({ hasVoted: false });
    }

    const voteStatus = await communityService.getUserVoteStatus(
      eventId,
      submissionId,
      auth.user.id
    );

    return apiSuccess(voteStatus);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/events/[eventId]/submissions/[submissionId]/vote
 * Casts a community vote for a submission.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const { user } = await requireUser(req);

    const clientIp = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const vote = await communityService.castVote({
      eventId,
      submissionId,
      voter: user,
      ip: clientIp,
    });

    return apiSuccess(vote, 201);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * DELETE /api/v1/events/[eventId]/submissions/[submissionId]/vote
 * Retracts a previously cast community vote.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const { user } = await requireUser(req);

    const result = await communityService.retractVote({
      eventId,
      submissionId,
      voterId: user.id,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
