import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { normalizationService } from "@/server/services/normalization.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const { searchParams } = new URL(req.url);
    const trackId = searchParams.get("trackId") || undefined;

    const analytics = await normalizationService.getCalibrationAnalytics(eventId, trackId);

    return NextResponse.json({ data: analytics });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
