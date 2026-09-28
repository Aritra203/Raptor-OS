import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { rubricService } from "@/server/services/rubric.service";
import { createRubricSchema } from "@/lib/validations/judging";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/rubrics
 * Creates a new judging rubric for the hackathon.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const rawBody = await req.json();
    const validated = createRubricSchema.parse(rawBody);

    const rubric = await rubricService.createRubric(auth.user.id, eventId, validated);

    return NextResponse.json(
      {
        data: rubric,
        meta: { message: "Rubric created successfully with version 1." },
      },
      { status: 201 }
    );
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * GET /api/events/[eventId]/rubrics
 * Lists all rubrics for the hackathon.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const rubrics = await rubricService.listEventRubrics(auth.user.id, eventId);

    return NextResponse.json({
      data: rubrics,
      meta: { count: rubrics.length },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
