import { NextRequest, NextResponse } from "next/server";
import { antiAbuseService } from "@/server/services/anti-abuse.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";
import type { AbuseSignalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/abuse-signals
 * Lists flagged abuse and suspicious activity signals for an event. (Organizer/Admin only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as AbuseSignalStatus | null;

    const signals = await antiAbuseService.getAbuseSignals(
      eventId,
      status || undefined
    );

    return NextResponse.json({ signals });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
