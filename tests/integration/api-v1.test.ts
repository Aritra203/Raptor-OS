import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { apiKeyService } from "@/server/services/api-key.service";
import { NextRequest } from "next/server";
import { GET as getMe } from "@/app/api/v1/auth/me/route";
import { GET as getEvents } from "@/app/api/v1/events/route";
import { GET as getEventById } from "@/app/api/v1/events/[eventId]/route";
import { GET as getPublicKey } from "@/app/api/v1/public-key/route";
import { GET as getOpenApi } from "@/app/api/v1/openapi.json/route";

describe("REST API v1 Core & Authentication Integration Tests (Phase 9)", () => {
  const adminUserId = "usr_admin_1";
  const eventId = "evt_raptor_2026";
  let createdKeyToken: string = "";
  let createdKeyId: string = "";

  beforeAll(async () => {
    // Generate an API key for usr_admin_1
    const res = await apiKeyService.createApiKey(adminUserId, {
      name: "Phase 9 Test Key",
      expiresInDays: 30,
    });
    createdKeyToken = res.secretKey;
    createdKeyId = res.apiKey.id;
  });

  afterAll(async () => {
    if (createdKeyId) {
      await prisma.apiKey.deleteMany({ where: { id: createdKeyId } });
    }
  });

  it("authenticates via Bearer API Key and resolves user context at /api/v1/auth/me", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${createdKeyToken}`,
      },
    });

    const res = await getMe(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.user.id).toBe(adminUserId);
    expect(body.data.user.email).toBe("admin@raptoros.internal");
    // Password hash must never be leaked
    expect((body.data.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("returns 401 Unauthorized when Bearer token is invalid or missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: {
        Authorization: "Bearer rap_live_000000000000000000000000000000000000000000000000",
      },
    });

    const res = await getMe(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("retrieves events with standardized pagination metadata at /api/v1/events", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/events?page=1&limit=5");
    const res = await getEvents(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(5);
    expect(typeof body.meta.total).toBe("number");
  });

  it("retrieves a single event by ID at /api/v1/events/[eventId]", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/events/${eventId}`);
    const res = await getEventById(req, {
      params: Promise.resolve({ eventId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(eventId);
    expect(body.data.slug).toBe("raptor-hack-2026");
  });

  it("exposes the server's Ed25519 public verification key at /api/v1/public-key", async () => {
    const res = await getPublicKey();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(body.data.algorithm).toBe("Ed25519");
  });

  it("serves the valid OpenAPI specification at /api/v1/openapi.json", async () => {
    const res = await getOpenApi();
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toMatch(/^3\.[01]\./);
    expect(spec.info.title).toBe("RaptorOS REST API");
    expect(spec.paths["/events"]).toBeDefined();
    expect(spec.paths["/auth/me"]).toBeDefined();
  });

  it("revokes an API key and immediately rejects subsequent requests", async () => {
    await apiKeyService.revokeApiKey(adminUserId, createdKeyId);

    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${createdKeyToken}`,
      },
    });

    const res = await getMe(req);
    expect(res.status).toBe(401);
  });
});
