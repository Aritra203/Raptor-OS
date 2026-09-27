import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { apiKeyService } from "@/server/services/api-key.service";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/v1/auth/keys/[keyId]
 * Revokes an API key owned by the authenticated user.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const { user } = await requireUser(req);
    const { keyId } = await params;
    const revoked = await apiKeyService.revokeApiKey(user.id, keyId);
    return apiSuccess(revoked);
  } catch (error) {
    return apiError(error);
  }
}
