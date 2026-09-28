import { NextRequest } from "next/server";
import { certificateService } from "@/server/services/certificate.service";
import { certificateRepository } from "@/server/repositories/certificate.repository";
import { requireEventRole } from "@/server/auth/authorization";
import { issueCertificateSchema } from "@/lib/validations/api-v1";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { toCertificateDTO } from "@/server/dto/api-v1.dto";
import type { CertificateType } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/certificates
 * Lists certificates issued for an event (Organizer/Admin only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);
    const type = (req.nextUrl.searchParams.get("type") as CertificateType) || undefined;
    const isRevokedParam = req.nextUrl.searchParams.get("isRevoked");
    const isRevoked =
      isRevokedParam !== null ? isRevokedParam === "true" : undefined;

    const [certs, total] = await Promise.all([
      certificateRepository.findManyByEvent(eventId, {
        skip,
        take: limit,
        type,
        isRevoked,
      }),
      certificateRepository.countByEvent(eventId, { type, isRevoked }),
    ]);

    const dtos = certs.map(toCertificateDTO);
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/events/[eventId]/certificates
 * Issues a verifiable certificate (Organizer/Admin only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = issueCertificateSchema.parse(body);

    const cert = await certificateService.issueCertificate(
      eventId,
      user.id,
      validated
    );

    return apiSuccess(cert, 201);
  } catch (error) {
    return apiError(error);
  }
}
