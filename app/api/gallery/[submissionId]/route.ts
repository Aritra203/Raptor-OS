import { NextRequest, NextResponse } from "next/server";
import { galleryService } from "@/server/services/gallery.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/gallery/[submissionId]
 * Retrieves safe public details of an eligible submission.
 * Rejects drafts, disqualified projects, and draft events with HTTP 404.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const project = await galleryService.getPublicSubmission(submissionId);

    return NextResponse.json({ data: project });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
