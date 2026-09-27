import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { webhookRepository } from "@/server/repositories/webhook.repository";
import { auditService } from "@/server/services/audit.service";
import { computeHmacSha256 } from "@/lib/crypto/signing";
import { NotFoundError } from "@/lib/errors/app-error";
import { validateWebhookUrl, isSafeWebhookUrl } from "@/lib/security/ssrf";
import type { WebhookDTO, WebhookDeliveryDTO } from "@/server/dto/api-v1.dto";
import { toWebhookDTO, toWebhookDeliveryDTO } from "@/server/dto/api-v1.dto";

export class WebhookService {
  /**
   * Generates a 256-bit cryptographically random webhook signing secret.
   */
  generateSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString("hex")}`;
  }

  /**
   * Registers a new event-scoped webhook subscription.
   */
  async createWebhook(
    eventId: string,
    creatorId: string,
    input: {
      name: string;
      url: string;
      secret?: string;
      events: string[];
      isActive?: boolean;
    }
  ): Promise<{ webhook: WebhookDTO; secret: string }> {
    validateWebhookUrl(input.url);

    const rawSecret = input.secret || this.generateSecret();

    const webhook = await webhookRepository.create({
      eventId,
      name: input.name,
      url: input.url,
      secret: rawSecret,
      events: input.events,
      isActive: input.isActive ?? true,
    });

    await auditService.logAction({
      eventId,
      actorId: creatorId,
      action: "WEBHOOK_CREATED",
      entityType: "Webhook",
      entityId: webhook.id,
      metadata: { name: webhook.name, url: webhook.url, events: webhook.events },
    });

    return {
      webhook: toWebhookDTO(webhook),
      secret: rawSecret,
    };
  }

  /**
   * Updates an existing webhook subscription.
   */
  async updateWebhook(
    eventId: string,
    webhookId: string,
    updaterId: string,
    input: {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    }
  ): Promise<WebhookDTO> {
    const existing = await webhookRepository.findById(webhookId);
    if (!existing || existing.eventId !== eventId) {
      throw new NotFoundError("Webhook", webhookId);
    }

    if (input.url) {
      validateWebhookUrl(input.url);
    }

    const updated = await webhookRepository.update(webhookId, input);

    await auditService.logAction({
      eventId,
      actorId: updaterId,
      action: "WEBHOOK_UPDATED",
      entityType: "Webhook",
      entityId: webhookId,
      metadata: input,
    });

    return toWebhookDTO(updated);
  }

  /**
   * Deletes a webhook subscription.
   */
  async deleteWebhook(
    eventId: string,
    webhookId: string,
    deleterId: string
  ): Promise<void> {
    const existing = await webhookRepository.findById(webhookId);
    if (!existing || existing.eventId !== eventId) {
      throw new NotFoundError("Webhook", webhookId);
    }

    await webhookRepository.delete(webhookId);

    await auditService.logAction({
      eventId,
      actorId: deleterId,
      action: "WEBHOOK_DELETED",
      entityType: "Webhook",
      entityId: webhookId,
    });
  }

  /**
   * Dispatches an event to all matching active webhook subscriptions.
   * Completely non-blocking and resilient to offline destination failures.
   */
  async dispatchWebhookEvent(
    eventId: string,
    eventType: string,
    payloadData: unknown
  ): Promise<WebhookDeliveryDTO[]> {
    const subscribers = await webhookRepository.findActiveSubscribers(
      eventId,
      eventType
    );
    if (subscribers.length === 0) {
      return [];
    }

    const timestamp = new Date().toISOString();
    const results: WebhookDeliveryDTO[] = [];

    for (const webhook of subscribers) {
      const deliveryId = `del_${crypto.randomUUID()}`;
      const payload = {
        id: deliveryId,
        event: eventType,
        timestamp,
        data: payloadData,
      };

      const signature = computeHmacSha256(payload, webhook.secret);

      // Create delivery record
      const delivery = await webhookRepository.createDelivery({
        webhookId: webhook.id,
        eventId,
        eventType,
        deliveryId,
        payload,
        status: "PENDING",
      });

      // Fire asynchronous delivery without awaiting or throwing
      this.executeDelivery(delivery.id, webhook.url, payload, signature, deliveryId, eventType, timestamp);

      results.push(toWebhookDeliveryDTO(delivery));
    }

    return results;
  }

  /**
   * Executes HTTP POST delivery with timeout and error capture.
   */
  private async executeDelivery(
    deliveryDbId: string,
    url: string,
    payload: object,
    signature: string,
    deliveryId: string,
    eventType: string,
    timestamp: string
  ): Promise<void> {
    try {
      if (!isSafeWebhookUrl(url)) {
        await webhookRepository.updateDelivery(deliveryDbId, {
          status: "FAILED",
          attemptCount: 1,
          failureReason: "Blocked by SSRF protection policy: prohibited destination URL",
        });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RaptorOS-Signature": `sha256=${signature}`,
          "X-RaptorOS-Delivery": deliveryId,
          "X-RaptorOS-Event": eventType,
          "X-RaptorOS-Timestamp": timestamp,
          "User-Agent": "RaptorOS-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "error",
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => "");
      const isSuccess = response.ok;

      await webhookRepository.updateDelivery(deliveryDbId, {
        status: isSuccess ? "SUCCESS" : "FAILED",
        attemptCount: 1,
        statusCode: response.status,
        responseBody: responseBody.slice(0, 1000),
        deliveredAt: isSuccess ? new Date() : null,
        failureReason: isSuccess ? null : `HTTP status ${response.status}`,
      });
    } catch (err: unknown) {
      // Graceful offline failure handling: capture error without crashing application
      await webhookRepository.updateDelivery(deliveryDbId, {
        status: "FAILED",
        attemptCount: 1,
        failureReason: (err as Error)?.message ? String((err as Error).message).slice(0, 500) : "Network error or unreachable host",
      });
    }
  }

  /**
   * Manually retries a previously failed delivery.
   */
  async retryDelivery(
    eventId: string,
    deliveryId: string
  ): Promise<WebhookDeliveryDTO> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { deliveryId },
      include: { webhook: true },
    });

    if (!delivery || delivery.eventId !== eventId) {
      throw new NotFoundError("Webhook delivery", deliveryId);
    }

    const timestamp = new Date().toISOString();
    const signature = computeHmacSha256(delivery.payload as object, delivery.webhook.secret);

    // Increment attempt count
    await webhookRepository.updateDelivery(delivery.id, {
      status: "PENDING",
      attemptCount: delivery.attemptCount + 1,
    });

    await this.executeDelivery(
      delivery.id,
      delivery.webhook.url,
      delivery.payload as object,
      signature,
      delivery.deliveryId,
      delivery.eventType,
      timestamp
    );

    const refreshed = await prisma.webhookDelivery.findUnique({
      where: { id: delivery.id },
    });

    return toWebhookDeliveryDTO(refreshed || delivery);
  }
}

export const webhookService = new WebhookService();
