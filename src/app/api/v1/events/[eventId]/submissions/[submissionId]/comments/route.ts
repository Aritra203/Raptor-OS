import { NextRequest } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireUser, resolveSessionUser } from "@/server/auth/authorization";
import { createCommentSchema } from "@/lib/validations/community";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/submissions/[submissionId]/comments
 * Retrieves discussion comments for a submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    const { comments } = await communityService.getSubmissionComments(
      submissionId,
      { isOrganizer }
    );

    const sanitized = comments.map((c) => ({
      id: c.id,
      submissionId,
      author: {
        name: c.user.name,
      },
      content: c.content,
      moderationStatus: c.moderationStatus,
      createdAt: c.createdAt,
    }));

    return apiSuccess(sanitized);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/events/[eventId]/submissions/[submissionId]/comments
 * Posts a plain-text sanitized constructive comment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const { user } = await requireUser(req);

    const body = await req.json();
    const validated = createCommentSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const comment = await communityService.createComment({
      eventId,
      submissionId,
      author: user,
      content: validated.content,
      ip: clientIp,
    });

    return apiSuccess(comment, 201);
  } catch (error) {
    return apiError(error);
  }
}
