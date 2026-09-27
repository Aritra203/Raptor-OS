import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { resultsService } from "@/server/services/results.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; snapshotId: string }> }
) {
  try {
    const { eventId, snapshotId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const snapshot = await resultsService.getSnapshotById(snapshotId);

    return NextResponse.json({ data: snapshot });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
