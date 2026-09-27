import { NextRequest } from "next/server";
import { certificateService } from "@/server/services/certificate.service";
import { requireEventRole } from "@/server/auth/authorization";
import { revokeCertificateSchema } from "@/lib/validations/api-v1";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/events/[eventId]/certificates/[certificateId]/revoke
 * Revokes a previously issued certificate (Organizer/Admin only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; certificateId: string }> }
) {
  try {
    const { eventId, certificateId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const { reason } = revokeCertificateSchema.parse(body);

    const revoked = await certificateService.revokeCertificate(
      eventId,
      certificateId,
      user.id,
      reason
    );

    return apiSuccess(revoked);
  } catch (error) {
    return apiError(error);
  }
}
