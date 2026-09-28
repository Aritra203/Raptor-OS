import { NextRequest } from "next/server";
import { importService } from "@/server/services/import.service";
import { requireEventRole } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ValidationError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/events/[eventId]/import/[resource]
 * Bulk imports event resources (participants, teams, submissions) from CSV.
 * Requires Organizer or Admin event role.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; resource: string }> }
) {
  try {
    const { eventId, resource } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    let csvContent = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      csvContent = await req.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      if (!body.csv || typeof body.csv !== "string") {
        throw new ValidationError("Missing 'csv' string field in request body.");
      }
      csvContent = body.csv;
    } else {
      // Attempt to read text directly
      csvContent = await req.text();
    }

    if (!csvContent.trim()) {
      throw new ValidationError("CSV content is empty.");
    }

    const result = await importService.importResource(
      eventId,
      resource,
      user.id,
      csvContent
    );

    return apiSuccess(result, 200);
  } catch (error) {
    return apiError(error);
  }
}
