import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";
import type { CommentModerationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/comments
 * Lists comments across all submissions for an event for organizer moderation. (Organizer only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as CommentModerationStatus | null;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const result = await communityService.getEventComments(eventId, {
      status: status || undefined,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
