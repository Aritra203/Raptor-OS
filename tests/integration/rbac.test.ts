import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { authService } from "@/server/services/auth.service";
import {
  requireUser,
  requireEventMember,
  requireEventRole,
  requireAnyEventRole,
} from "@/server/auth/authorization";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors/app-error";
import type { Event, User } from "@prisma/client";

describe("Event-Scoped RBAC & Authorization Tests (Phase 3)", () => {
  const testPrefix = `test-rbac-${Date.now()}`;
  let event1: Event;
  let event2: Event;
  let alice: User;
  let aliceToken: string;
  let judgeBob: User;
  let judgeBobToken: string;
  let adminCharlie: User;
  let adminCharlieToken: string;

  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    // 1. Create two isolated events
    event1 = await prisma.event.create({
      data: {
        name: `${testPrefix} Event 1`,
        slug: `${testPrefix}-event-1`,
        state: "REGISTRATION_OPEN",
      },
    });
    event2 = await prisma.event.create({
      data: {
        name: `${testPrefix} Event 2`,
        slug: `${testPrefix}-event-2`,
        state: "REGISTRATION_OPEN",
      },
    });
    createdEventIds.push(event1.id, event2.id);

    // 2. Register Alice
    const aliceAuth = await authService.register({
      name: "Alice CrossRole",
      email: `${testPrefix}-alice@raptoros.local`,
      password: "AlicePassword123!",
      confirmPassword: "AlicePassword123!",
    });
    alice = (await prisma.user.findUnique({ where: { id: aliceAuth.user.id } }))!;
    aliceToken = aliceAuth.sessionToken;
    createdUserIds.push(alice.id);

    // 3. Register Judge Bob
    const bobAuth = await authService.register({
      name: "Judge Bob",
      email: `${testPrefix}-bob@raptoros.local`,
      password: "BobPassword123!",
      confirmPassword: "BobPassword123!",
    });
    judgeBob = (await prisma.user.findUnique({ where: { id: bobAuth.user.id } }))!;
    judgeBobToken = bobAuth.sessionToken;
    createdUserIds.push(judgeBob.id);

    // 4. Register Admin Charlie
    const charlieAuth = await authService.register({
      name: "Admin Charlie",
      email: `${testPrefix}-charlie@raptoros.local`,
      password: "CharliePassword123!",
      confirmPassword: "CharliePassword123!",
    });
    adminCharlie = (await prisma.user.findUnique({ where: { id: charlieAuth.user.id } }))!;
    adminCharlieToken = charlieAuth.sessionToken;
    createdUserIds.push(adminCharlie.id);

    // 5. Configure Event Memberships (Roles are EVENT-SCOPED)
    // Alice: ORGANIZER in Event 1, PARTICIPANT in Event 2
    await prisma.eventMembership.create({
      data: {
        eventId: event1.id,
        userId: alice.id,
        role: "ORGANIZER",
      },
    });
    await prisma.eventMembership.create({
      data: {
        eventId: event2.id,
        userId: alice.id,
        role: "PARTICIPANT",
      },
    });

    // Judge Bob: JUDGE in Event 1 ONLY (no membership in Event 2)
    await prisma.eventMembership.create({
      data: {
        eventId: event1.id,
        userId: judgeBob.id,
        role: "JUDGE",
      },
    });

    // Admin Charlie: ADMIN in Event 1 ONLY
    await prisma.eventMembership.create({
      data: {
        eventId: event1.id,
        userId: adminCharlie.id,
        role: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  function createMockRequest(token?: string): Request {
    const headers = new Headers();
    if (token) {
      headers.set("cookie", `raptoros_session=${token}`);
    }
    return new Request("http://localhost:3000/api/test", { headers });
  }

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    const unauthenticatedReq = createMockRequest();
    await expect(requireUser(unauthenticatedReq)).rejects.toThrowError(
      UnauthorizedError
    );
  });

  it("allows Alice organizer access in Event 1 where she holds ORGANIZER role", async () => {
    const req = createMockRequest(aliceToken);
    const context = await requireEventRole(event1.id, "ORGANIZER", req);

    expect(context.user.id).toBe(alice.id);
    expect(context.membership.eventId).toBe(event1.id);
    expect(context.membership.role).toBe("ORGANIZER");
  });

  it("STRICT CROSS-EVENT ISOLATION: Rejects Alice organizer access in Event 2 where she is only a PARTICIPANT", async () => {
    const req = createMockRequest(aliceToken);

    // Alice is an ORGANIZER in Event 1, but MUST BE FORBIDDEN from organizer actions in Event 2!
    await expect(
      requireEventRole(event2.id, "ORGANIZER", req)
    ).rejects.toThrowError(ForbiddenError);
  });

  it("allows Alice participant access in Event 2 where she is a PARTICIPANT", async () => {
    const req = createMockRequest(aliceToken);
    const context = await requireEventRole(event2.id, "PARTICIPANT", req);

    expect(context.user.id).toBe(alice.id);
    expect(context.membership.eventId).toBe(event2.id);
    expect(context.membership.role).toBe("PARTICIPANT");
  });

  it("allows Judge Bob judge access in Event 1", async () => {
    const req = createMockRequest(judgeBobToken);
    const context = await requireEventRole(event1.id, "JUDGE", req);

    expect(context.user.id).toBe(judgeBob.id);
    expect(context.membership.role).toBe("JUDGE");
  });

  it("CROSS-EVENT ISOLATION: Rejects Judge Bob in Event 2 where he has NO membership", async () => {
    const req = createMockRequest(judgeBobToken);

    // Judge in Event 1 has ZERO access to Event 2
    await expect(
      requireEventRole(event2.id, "JUDGE", req)
    ).rejects.toThrowError(ForbiddenError);

    await expect(
      requireEventMember(event2.id, req)
    ).rejects.toThrowError(ForbiddenError);
  });

  it("PREVENTS PRIVILEGE ESCALATION: Rejects Judge Bob calling organizer operations in Event 1", async () => {
    const req = createMockRequest(judgeBobToken);

    // Judge Bob cannot execute Organizer operations
    await expect(
      requireEventRole(event1.id, "ORGANIZER", req)
    ).rejects.toThrowError(ForbiddenError);
  });

  it("EVENT ADMIN SCOPE: Admin Charlie has admin/organizer access in Event 1, but NO permissions in Event 2", async () => {
    const req = createMockRequest(adminCharlieToken);

    // Allowed in Event 1
    const ctxAdmin = await requireEventRole(event1.id, "ADMIN", req);
    expect(ctxAdmin.membership.role).toBe("ADMIN");

    const ctxOrg = await requireEventRole(event1.id, "ORGANIZER", req);
    expect(ctxOrg.membership.role).toBe("ADMIN");

    // FORBIDDEN in Event 2 (Admin privileges are strictly event-scoped!)
    await expect(
      requireEventRole(event2.id, "ADMIN", req)
    ).rejects.toThrowError(ForbiddenError);

    await expect(
      requireEventRole(event2.id, "ORGANIZER", req)
    ).rejects.toThrowError(ForbiddenError);
  });

  it("verifies requireAnyEventRole helper correctly filters allowed roles", async () => {
    const aliceReq = createMockRequest(aliceToken);
    const bobReq = createMockRequest(judgeBobToken);

    // Allowed if Organizer or Judge
    const aliceCheck = await requireAnyEventRole(event1.id, ["ORGANIZER", "JUDGE"], aliceReq);
    expect(aliceCheck.user.id).toBe(alice.id);

    const bobCheck = await requireAnyEventRole(event1.id, ["ORGANIZER", "JUDGE"], bobReq);
    expect(bobCheck.user.id).toBe(judgeBob.id);

    // Disallowed for Bob if only Admin or Organizer
    await expect(
      requireAnyEventRole(event1.id, ["ADMIN", "ORGANIZER"], bobReq)
    ).rejects.toThrowError(ForbiddenError);
  });
});
