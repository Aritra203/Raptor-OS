import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireEventRole } from "@/server/auth/authorization";
import { moderateCommentSchema } from "@/lib/validations/community";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/events/[eventId]/comments/[commentId]/moderate
 * Updates the moderation status of a comment (PUBLISHED, HIDDEN, REMOVED). (Organizer/Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; commentId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId, commentId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = moderateCommentSchema.parse(body);

    const updated = await communityService.moderateComment(
      commentId,
      user.id,
      validated.status
    );

    return NextResponse.json({
      success: true,
      comment: updated,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
