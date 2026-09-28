import { NextRequest, NextResponse } from "next/server";
import { exportService } from "@/server/services/export.service";
import { requireEventRole } from "@/server/auth/authorization";
import { apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/export/[resource]
 * Exports event resources (participants, teams, submissions, scores, results, votes, comments, certificates) as CSV.
 * Requires Organizer or Admin event role.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; resource: string }> }
) {
  try {
    const { eventId, resource } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const { filename, csv } = await exportService.exportResource(
      eventId,
      resource,
      user.id
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
