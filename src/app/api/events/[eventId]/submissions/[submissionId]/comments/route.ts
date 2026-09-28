import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import { requireUser, resolveSessionUser } from "@/server/auth/authorization";
import { createCommentSchema } from "@/lib/validations/community";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/submissions/[submissionId]/comments
 * Retrieves paginated public comments for a submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const limit = Number(url.searchParams.get("limit") || 20);

    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    const result = await communityService.getSubmissionComments(submissionId, {
      page,
      limit,
      isOrganizer,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/events/[eventId]/submissions/[submissionId]/comments
 * Submits a new comment on a project. (Authenticated user)
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
    const body = await req.json();
    const validated = createCommentSchema.parse(body);

    const comment = await communityService.createComment({
      eventId,
      submissionId,
      author: user,
      content: validated.content,
      ip,
    });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
