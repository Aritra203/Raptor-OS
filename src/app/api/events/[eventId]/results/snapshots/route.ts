import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { resultsService } from "@/server/services/results.service";
import { createResultSnapshotSchema } from "@/lib/validations/results";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const validated = createResultSnapshotSchema.parse(body);
    const snapshot = await resultsService.createSnapshot(eventId, auth.user.id, validated);

    return NextResponse.json({ data: snapshot }, { status: 201 });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const snapshots = await resultsService.getSnapshots(eventId);

    return NextResponse.json({ data: snapshots });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
