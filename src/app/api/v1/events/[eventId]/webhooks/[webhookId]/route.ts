import { NextRequest } from "next/server";
import { webhookService } from "@/server/services/webhook.service";
import { webhookRepository } from "@/server/repositories/webhook.repository";
import { requireEventRole } from "@/server/auth/authorization";
import { updateWebhookSchema } from "@/lib/validations/api-v1";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors/app-error";
import { toWebhookDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/webhooks/[webhookId]
 * Retrieves details of a specific webhook.
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

    return apiSuccess(toWebhookDTO(webhook));
  } catch (error) {
    return apiError(error);
  }
}

/**
 * PUT /api/v1/events/[eventId]/webhooks/[webhookId]
 * Updates an existing webhook subscription.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; webhookId: string }> }
) {
  try {
    const { eventId, webhookId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = updateWebhookSchema.parse(body);

    const updated = await webhookService.updateWebhook(
      eventId,
      webhookId,
      user.id,
      validated
    );

    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * DELETE /api/v1/events/[eventId]/webhooks/[webhookId]
 * Deletes a webhook subscription.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; webhookId: string }> }
) {
  try {
    const { eventId, webhookId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    await webhookService.deleteWebhook(eventId, webhookId, user.id);

    return apiSuccess({ success: true, message: "Webhook deleted successfully." });
  } catch (error) {
    return apiError(error);
  }
}
