import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { webhookService } from "@/server/services/webhook.service";

describe("Webhook Subsystem Integration Tests (Phase 9)", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";
  let createdWebhookId: string = "";

  afterAll(async () => {
    if (createdWebhookId) {
      await prisma.webhookDelivery.deleteMany({
        where: { webhookId: createdWebhookId },
      });
      await prisma.webhook.deleteMany({
        where: { id: createdWebhookId },
      });
    }
  });

  it("creates a webhook subscription with auto-generated secret and event filters", async () => {
    const result = await webhookService.createWebhook(eventId, organizerId, {
      name: "Integration Test Webhook",
      url: "http://127.0.0.1:9999/test-webhook",
      events: ["submission.created", "certificate.issued"],
      isActive: true,
    });

    expect(result).toBeDefined();
    expect(result.webhook).toBeDefined();
    expect(result.webhook.id).toBeDefined();
    expect(result.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(result.webhook.events).toContain("submission.created");

    createdWebhookId = result.webhook.id;
  });

  it("dispatches webhook event and creates delivery record offline-safely", async () => {
    const deliveries = await webhookService.dispatchWebhookEvent(
      eventId,
      "submission.created",
      {
        submissionId: "sub_test_1",
        title: "AI Pipeline Offline",
        submittedAt: new Date().toISOString(),
      }
    );

    // Because 127.0.0.1:9999 is not listening, the delivery should fail gracefully
    // and record delivery without crashing or throwing an unhandled rejection.
    expect(deliveries).toBeDefined();
    expect(deliveries.length).toBeGreaterThan(0);

    // Give asynchronous fetch failure handler 200ms to record status in database
    await new Promise((r) => setTimeout(r, 300));

    // Verify record in database
    const savedDeliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: createdWebhookId },
      orderBy: { createdAt: "desc" },
    });

    expect(savedDeliveries.length).toBeGreaterThan(0);
    const first = savedDeliveries[0];
    expect(first?.eventType).toBe("submission.created");
  });

  it("filters events and does not dispatch to unsubscribed endpoints", async () => {
    const initialCount = await prisma.webhookDelivery.count({
      where: { webhookId: createdWebhookId },
    });

    // Dispatch an event the webhook is NOT subscribed to (e.g. vote.cast)
    await webhookService.dispatchWebhookEvent(eventId, "vote.cast", {
      submissionId: "sub_test_1",
      voteId: "vote_123",
    });

    const newCount = await prisma.webhookDelivery.count({
      where: { webhookId: createdWebhookId },
    });

    expect(newCount).toBe(initialCount);
  });

  it("strictly rejects SSRF malicious destinations (cloud metadata & prohibited ports)", async () => {
    // 1. Cloud metadata URL rejection
    await expect(
      webhookService.createWebhook(eventId, organizerId, {
        name: "Malicious Metadata Hook",
        url: "http://169.254.169.254/latest/meta-data",
        events: ["submission.created"],
      })
    ).rejects.toThrow(/SSRF/);

    // 2. Prohibited database port rejection
    await expect(
      webhookService.createWebhook(eventId, organizerId, {
        name: "Malicious Port Hook",
        url: "http://example.com:5432/webhook",
        events: ["submission.created"],
      })
    ).rejects.toThrow(/port 5432/i);
  });
});
