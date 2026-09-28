import { NextRequest, NextResponse } from "next/server";
import { antiAbuseService } from "@/server/services/anti-abuse.service";
import { requireEventRole } from "@/server/auth/authorization";
import { reviewAbuseSignalSchema } from "@/lib/validations/community";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/events/[eventId]/abuse-signals/[signalId]
 * Reviews and updates an abuse signal status. (Organizer/Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; signalId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId, signalId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = reviewAbuseSignalSchema.parse(body);

    const updated = await antiAbuseService.reviewAbuseSignal(
      signalId,
      user.id,
      validated.status,
      validated.reviewNotes
    );

    return NextResponse.json({
      success: true,
      signal: updated,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
