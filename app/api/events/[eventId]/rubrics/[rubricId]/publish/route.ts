import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { rubricService } from "@/server/services/rubric.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/rubrics/[rubricId]/publish
 * Publishes a specific rubric version as active.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; rubricId: string }> }
) {
  try {
    const auth = await requireUser(req);
    await params;

    const body = await req.json();
    const versionId = body.versionId;

    if (!versionId || typeof versionId !== "string") {
      return NextResponse.json(
        { error: { message: "versionId is required in request body" } },
        { status: 400 }
      );
    }

    const version = await rubricService.publishRubricVersion(auth.user.id, versionId);

    return NextResponse.json({
      data: version,
      meta: { message: `Rubric version ${version.versionNumber} published successfully.` },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
