import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { resultsService } from "@/server/services/results.service";
import { publishResultsSchema } from "@/lib/validations/results";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; snapshotId: string }> }
) {
  try {
    const { eventId, snapshotId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const validated = publishResultsSchema.parse(body);

    const published = await resultsService.publishSnapshot(
      eventId,
      snapshotId,
      auth.user.id,
      validated
    );

    return NextResponse.json({ data: published });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
