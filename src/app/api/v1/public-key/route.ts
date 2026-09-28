import { getPublicVerificationKey } from "@/lib/crypto/signing";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/public-key
 * Exports the server's Ed25519 public verification key for offline third-party validation.
 */
export async function GET() {
  try {
    const publicKeyPem = await getPublicVerificationKey();
    return apiSuccess({
      algorithm: "Ed25519",
      format: "SPKI-PEM",
      publicKey: publicKeyPem,
    });
  } catch (error) {
    return apiError(error);
  }
}
