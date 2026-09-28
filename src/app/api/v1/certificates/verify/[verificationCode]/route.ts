import { NextRequest } from "next/server";
import { certificateService } from "@/server/services/certificate.service";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/certificates/verify/[verificationCode]
 * Public certificate verification endpoint.
 * Returns VALID, REVOKED, or NOT_FOUND without leaking recipient emails or internal identifiers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verificationCode: string }> }
) {
  try {
    const { verificationCode } = await params;
    const clientIp = req.headers.get("x-forwarded-for") || "127.0.0.1";

    const result = await certificateService.verifyCertificate(
      verificationCode,
      clientIp
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
