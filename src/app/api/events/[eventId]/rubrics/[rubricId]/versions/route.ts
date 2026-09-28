import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { rubricService } from "@/server/services/rubric.service";
import { createRubricVersionSchema } from "@/lib/validations/judging";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/rubrics/[rubricId]/versions
 * Creates a new version for an existing rubric.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; rubricId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { rubricId } = await params;

    const rawBody = await req.json();
    const validated = createRubricVersionSchema.parse(rawBody);
    const activate = Boolean(rawBody.activate);

    const version = await rubricService.createRubricVersion(
      auth.user.id,
      rubricId,
      validated,
      activate
    );

    return NextResponse.json(
      {
        data: version,
        meta: { message: `Rubric version ${version.versionNumber} created successfully.` },
      },
      { status: 201 }
    );
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
