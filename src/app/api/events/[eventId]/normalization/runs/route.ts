import { NextRequest, NextResponse } from "next/server";
import { requireEventRole } from "@/server/auth/authorization";
import { normalizationService } from "@/server/services/normalization.service";
import { createNormalizationRunSchema } from "@/lib/validations/results";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = createNormalizationRunSchema.parse(body);

    const result = await normalizationService.createRun(eventId, auth.user.id, validated);

    return NextResponse.json({ data: result }, { status: 201 });
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

    const runs = await normalizationService.getRunsForEvent(eventId);

    return NextResponse.json({ data: runs });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
