import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { resultsService } from "@/server/services/results.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; snapshotId: string }> }
) {
  try {
    const { eventId, snapshotId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);

    const finalized = await resultsService.finalizeSnapshot(eventId, snapshotId, auth.user.id);

    return NextResponse.json({ data: finalized });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
