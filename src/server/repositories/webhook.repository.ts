import { prisma } from "@/lib/db/prisma";
import type { Webhook, WebhookDelivery, Prisma } from "@prisma/client";

export class WebhookRepository {
  async create(data: {
    eventId: string;
    name: string;
    url: string;
    secret: string;
    events: string[];
    isActive?: boolean;
  }): Promise<Webhook> {
    return prisma.webhook.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        url: data.url,
        secret: data.secret,
        events: data.events as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Webhook | null> {
    return prisma.webhook.findUnique({
      where: { id },
    });
  }

  async findManyByEvent(
    eventId: string,
    options: { skip?: number; take?: number } = {}
  ): Promise<Webhook[]> {
    return prisma.webhook.findMany({
      where: { eventId },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
    });
  }

  async countByEvent(eventId: string): Promise<number> {
    return prisma.webhook.count({
      where: { eventId },
    });
  }

  async findActiveSubscribers(
    eventId: string,
    eventType: string
  ): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        eventId,
        isActive: true,
      },
    });

    return webhooks.filter((w) => {
      if (Array.isArray(w.events)) {
        return (w.events as string[]).includes(eventType);
      }
      return false;
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      url?: string;
      secret?: string;
      events?: string[];
      isActive?: boolean;
    }
  ): Promise<Webhook> {
    return prisma.webhook.update({
      where: { id },
      data: {
        name: data.name,
        url: data.url,
        secret: data.secret,
        ...(data.events ? { events: data.events as Prisma.InputJsonValue } : {}),
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string): Promise<Webhook> {
    return prisma.webhook.delete({
      where: { id },
    });
  }

  async createDelivery(data: {
    webhookId: string;
    eventId: string;
    eventType: string;
    deliveryId: string;
    payload: unknown;
    status?: string;
    attemptCount?: number;
    statusCode?: number | null;
    responseBody?: string | null;
    failureReason?: string | null;
    deliveredAt?: Date | null;
  }): Promise<WebhookDelivery> {
    return prisma.webhookDelivery.create({
      data: {
        webhookId: data.webhookId,
        eventId: data.eventId,
        eventType: data.eventType,
        deliveryId: data.deliveryId,
        payload: data.payload as Prisma.InputJsonValue,
        status: data.status || "PENDING",
        attemptCount: data.attemptCount || 0,
        statusCode: data.statusCode,
        responseBody: data.responseBody,
        failureReason: data.failureReason,
        deliveredAt: data.deliveredAt,
      },
    });
  }

  async updateDelivery(
    id: string,
    data: {
      status?: string;
      attemptCount?: number;
      statusCode?: number | null;
      responseBody?: string | null;
      nextRetryAt?: Date | null;
      failureReason?: string | null;
      deliveredAt?: Date | null;
    }
  ): Promise<WebhookDelivery> {
    return prisma.webhookDelivery.update({
      where: { id },
      data,
    });
  }

  async findDeliveries(
    webhookId: string,
    options: { skip?: number; take?: number } = {}
  ): Promise<WebhookDelivery[]> {
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
    });
  }

  async countDeliveries(webhookId: string): Promise<number> {
    return prisma.webhookDelivery.count({
      where: { webhookId },
    });
  }
}

export const webhookRepository = new WebhookRepository();
