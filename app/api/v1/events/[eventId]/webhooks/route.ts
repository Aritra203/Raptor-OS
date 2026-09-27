import { NextRequest } from "next/server";
import { webhookService } from "@/server/services/webhook.service";
import { webhookRepository } from "@/server/repositories/webhook.repository";
import { requireEventRole } from "@/server/auth/authorization";
import { createWebhookSchema } from "@/lib/validations/api-v1";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { apiSuccess, apiError } from "@/lib/api/response";
import { toWebhookDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/webhooks
 * Lists webhook subscriptions for an event (Organizer/Admin only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);

    const { page, limit, skip } = parsePaginationParams(req.nextUrl.searchParams);

    const [webhooks, total] = await Promise.all([
      webhookRepository.findManyByEvent(eventId, { skip, take: limit }),
      webhookRepository.countByEvent(eventId),
    ]);

    const dtos = webhooks.map(toWebhookDTO);
    const meta = buildPaginationMeta(total, page, limit);

    return apiSuccess(dtos, 200, meta);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/events/[eventId]/webhooks
 * Creates a new webhook subscription (Organizer/Admin only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = createWebhookSchema.parse(body);

    const result = await webhookService.createWebhook(
      eventId,
      user.id,
      validated
    );

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
