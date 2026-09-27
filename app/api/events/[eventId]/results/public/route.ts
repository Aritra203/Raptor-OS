import { NextRequest, NextResponse } from "next/server";
import { resultsService } from "@/server/services/results.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const publicResults = await resultsService.getPublicResults(eventId);

    return NextResponse.json({ data: publicResults });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
