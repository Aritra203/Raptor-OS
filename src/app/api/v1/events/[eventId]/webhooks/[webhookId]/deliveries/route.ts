import { NextRequest } from "next/server";
import { webhookRepository } from "@/server/repositories/webhook.repository";
import { requireEventRole } from "@/server/auth/authorization";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toWebhookDeliveryDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/webhooks/[webhookId]/deliveries
 * Lists delivery attempts and status for a webhook.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; webhookId: string }> }
) {
  try {
    const { eventId, webhookId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const webhook = await webhookRepository.findById(webhookId);
    if (!webhook || webhook.eventId !== eventId) {
      throw new NotFoundError("Webhook", webhookId);
    }

    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);

    const [deliveries, total] = await Promise.all([
      webhookRepository.findDeliveries(webhookId, { skip, take: limit }),
      webhookRepository.countDeliveries(webhookId),
    ]);

    const dtos = deliveries.map(toWebhookDeliveryDTO);
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}
