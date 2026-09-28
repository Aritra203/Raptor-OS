import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { resultsService } from "@/server/services/results.service";
import { generateRankingsSchema } from "@/lib/validations/results";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const validated = generateRankingsSchema.parse(body);
    const rankings = await resultsService.generateRankings(eventId, validated);

    return NextResponse.json({ data: rankings });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
