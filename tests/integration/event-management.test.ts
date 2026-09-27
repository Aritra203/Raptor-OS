import { describe, it, expect, afterAll } from "vitest";
import { eventService } from "@/server/services/event.service";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, ConflictError } from "@/lib/errors/app-error";

describe("Event Management & Lifecycle Integration Tests (Phase 4)", () => {
  const testPrefix = `test-evt-${Date.now()}`;
  const createdEventIds: string[] = [];
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.event.deleteMany({
        where: { id: { in: createdEventIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("creates a new event and automatically assigns creator as event ORGANIZER", async () => {
    // 1. Create a test creator user
    const creator = await prisma.user.create({
      data: {
        email: `${testPrefix}-creator@example.com`,
        name: "Event Creator",
      },
    });
    createdUserIds.push(creator.id);

    // 2. Create the event
    const event = await eventService.createEvent(
      {
        name: "Decentralized Hack 2026",
        slug: `${testPrefix}-decentralized-hack`,
        description: "A hackathon testing organizer automation.",
        minTeamSize: 2,
        maxTeamSize: 5,
      },
      creator.id
    );
    createdEventIds.push(event.id);

    expect(event.id).toBeDefined();
    expect(event.name).toBe("Decentralized Hack 2026");
    expect(event.state).toBe("DRAFT");
    expect(event.minTeamSize).toBe(2);
    expect(event.maxTeamSize).toBe(5);

    // 3. Verify creator's event membership was automatically created with ORGANIZER role
    const membership = await prisma.eventMembership.findUnique({
      where: {
        userId_eventId_role: {
          userId: creator.id,
          eventId: event.id,
          role: "ORGANIZER",
        },
      },
    });

    expect(membership).toBeDefined();
    expect(membership?.role).toBe("ORGANIZER");
    expect(membership?.status).toBe("ACTIVE");

    // 4. Verify audit log was generated
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        eventId: event.id,
        action: "EVENT_CREATED",
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(creator.id);
  });

  it("rejects creating an event with a duplicate slug", async () => {
    const creator = await prisma.user.create({
      data: {
        email: `${testPrefix}-creator2@example.com`,
        name: "Creator Two",
      },
    });
    createdUserIds.push(creator.id);

    const slug = `${testPrefix}-duplicate-slug`;

    const event1 = await eventService.createEvent(
      { name: "Original Event", slug },
      creator.id
    );
    createdEventIds.push(event1.id);

    // Attempt to create another event with identical slug
    await expect(
      eventService.createEvent({ name: "Copycat Event", slug }, creator.id)
    ).rejects.toThrow(ConflictError);
  });

  it("rejects illegal state transition leaps (e.g. DRAFT to JUDGING_OPEN)", async () => {
    const creator = await prisma.user.create({
      data: {
        email: `${testPrefix}-creator3@example.com`,
        name: "Creator Three",
      },
    });
    createdUserIds.push(creator.id);

    const event = await eventService.createEvent(
      { name: "State Test Event", slug: `${testPrefix}-state-test` },
      creator.id
    );
    createdEventIds.push(event.id);

    expect(event.state).toBe("DRAFT");

    // Attempt illegal transition: DRAFT -> JUDGING_OPEN
    await expect(
      eventService.transitionEvent(event.id, "JUDGING_OPEN", creator.id)
    ).rejects.toThrow(ValidationError);

    // Verify event remains DRAFT in database
    const dbEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(dbEvent?.state).toBe("DRAFT");
  });

  it("permits legal lifecycle transitions with audit trail", async () => {
    const creator = await prisma.user.create({
      data: {
        email: `${testPrefix}-creator4@example.com`,
        name: "Creator Four",
      },
    });
    createdUserIds.push(creator.id);

    const event = await eventService.createEvent(
      { name: "Valid Transition Event", slug: `${testPrefix}-valid-transition` },
      creator.id
    );
    createdEventIds.push(event.id);

    // Transition 1: DRAFT -> REGISTRATION_OPEN
    const updated1 = await eventService.transitionEvent(
      event.id,
      "REGISTRATION_OPEN",
      creator.id
    );
    expect(updated1.state).toBe("REGISTRATION_OPEN");

    // Transition 2: REGISTRATION_OPEN -> REGISTRATION_CLOSED
    const updated2 = await eventService.transitionEvent(
      event.id,
      "REGISTRATION_CLOSED",
      creator.id
    );
    expect(updated2.state).toBe("REGISTRATION_CLOSED");

    // Verify audit logs for transitions
    const logs = await prisma.auditLog.findMany({
      where: {
        eventId: event.id,
        action: "EVENT_LIFECYCLE_TRANSITION",
      },
    });
    expect(logs.length).toBe(2);
  });

  it("manages tracks and prizes scoped strictly to the event", async () => {
    const creator = await prisma.user.create({
      data: {
        email: `${testPrefix}-creator5@example.com`,
        name: "Creator Five",
      },
    });
    createdUserIds.push(creator.id);

    const event = await eventService.createEvent(
      { name: "Track & Prize Event", slug: `${testPrefix}-track-prize` },
      creator.id
    );
    createdEventIds.push(event.id);

    // Create a track
    const track = await eventService.createTrack(
      {
        eventId: event.id,
        name: "Autonomous Systems",
        slug: "autonomous-systems",
        description: "Robotics and AI track.",
      },
      creator.id
    );
    expect(track.id).toBeDefined();
    expect(track.name).toBe("Autonomous Systems");

    // Create a prize associated with the track
    const prize = await eventService.createPrize(
      {
        eventId: event.id,
        trackId: track.id,
        name: "Best Robotics Agent",
        value: 2500,
      },
      creator.id
    );
    expect(prize.id).toBeDefined();
    expect(prize.trackId).toBe(track.id);

    // Attempting to create a duplicate track slug in the same event must fail
    await expect(
      eventService.createTrack(
        {
          eventId: event.id,
          name: "Autonomous Systems Duplicate",
          slug: "autonomous-systems",
        },
        creator.id
      )
    ).rejects.toThrow(ConflictError);
  });
});
