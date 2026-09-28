import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { judgingService } from "@/server/services/judging.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/judge/assignments
 * Retrieves the judge's dashboard and list of assigned submissions across all events.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId") || undefined;

    const dashboard = await judgingService.getJudgeDashboard(auth.user.id, eventId);

    return NextResponse.json({
      data: dashboard,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
