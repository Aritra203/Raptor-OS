import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { normalizationService } from "@/server/services/normalization.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; runId: string }> }
) {
  try {
    const { eventId, runId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const run = await normalizationService.getRunById(runId);

    return NextResponse.json({ data: run });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
