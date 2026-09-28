import { NextRequest } from "next/server";
import { signedRecordsService } from "@/server/services/signed-records.service";
import { verifySignedRecordSchema } from "@/lib/validations/api-v1";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/events/[eventId]/judging/records/verify
 * Verifies that a published judge evaluation record has not been silently altered.
 */
export async function POST(
  req: NextRequest,
  { params: _params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const body = await req.json();
    const validated = verifySignedRecordSchema.parse(body);

    const result = await signedRecordsService.verifySignedRecord(
      "",
      validated.canonicalData,
      validated.signature
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
