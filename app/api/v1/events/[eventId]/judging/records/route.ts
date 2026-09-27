import { NextRequest } from "next/server";
import { signedRecordsService } from "@/server/services/signed-records.service";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/judging/records
 * Lists publicly verifiable signed judging records for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);

    const [records, total] = await Promise.all([
      signedRecordsService.getEventSignedRecords(eventId, { skip, take: limit }),
      prisma.signedJudgeRecord.count({ where: { eventId } }),
    ]);

    const meta = buildPaginationMeta(total, page, limit);
    return apiSuccess(records, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}
