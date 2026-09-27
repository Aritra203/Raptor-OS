import { describe, it, expect, afterAll } from "vitest";
import { registrationService } from "@/server/services/registration.service";
import { eventService } from "@/server/services/event.service";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, ConflictError } from "@/lib/errors/app-error";

describe("Participant Registration Integration Tests (Phase 4)", () => {
  const testPrefix = `test-reg-${Date.now()}`;
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

  it("registers a participant successfully when registration is open", async () => {
    // 1. Create organizer and event
    const organizer = await prisma.user.create({
      data: {
        email: `${testPrefix}-org1@example.com`,
        name: "Organizer One",
      },
    });
    createdUserIds.push(organizer.id);

    const event = await eventService.createEvent(
      {
        name: "Winter Hackathon",
        slug: `${testPrefix}-winter-hack`,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    // Transition event to REGISTRATION_OPEN
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);

    // 2. Create participant user
    const participant = await prisma.user.create({
      data: {
        email: `${testPrefix}-part1@example.com`,
        name: "Participant One",
      },
    });
    createdUserIds.push(participant.id);

    // 3. Register participant
    const membership = await registrationService.registerForEvent(participant.id, event.id);
    expect(membership).toBeDefined();
    expect(membership.userId).toBe(participant.id);
    expect(membership.eventId).toBe(event.id);
    expect(membership.role).toBe("PARTICIPANT");
    expect(membership.status).toBe("ACTIVE");

    // 4. Verify participant appears in event participants list
    const participants = await registrationService.listParticipants(event.id);
    expect(participants.length).toBe(1);
    expect(participants[0]?.userId).toBe(participant.id);

    // 5. Verify event appears in user's registration list
    const userRegistrations = await registrationService.listUserRegistrations(participant.id);
    expect(userRegistrations.length).toBe(1);
    expect(userRegistrations[0]?.eventId).toBe(event.id);
  });

  it("rejects registration if event is in DRAFT state", async () => {
    const organizer = await prisma.user.create({
      data: {
        email: `${testPrefix}-org2@example.com`,
        name: "Organizer Two",
      },
    });
    createdUserIds.push(organizer.id);

    const event = await eventService.createEvent(
      {
        name: "Draft Hackathon",
        slug: `${testPrefix}-draft-hack`,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    const participant = await prisma.user.create({
      data: {
        email: `${testPrefix}-part2@example.com`,
        name: "Participant Two",
      },
    });
    createdUserIds.push(participant.id);

    await expect(
      registrationService.registerForEvent(participant.id, event.id)
    ).rejects.toThrow(ValidationError);
  });

  it("rejects registration if registration deadline has passed", async () => {
    const organizer = await prisma.user.create({
      data: {
        email: `${testPrefix}-org3@example.com`,
        name: "Organizer Three",
      },
    });
    createdUserIds.push(organizer.id);

    // Create event with registrationEnd in the past
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const event = await prisma.event.create({
      data: {
        name: "Expired Registration Hack",
        slug: `${testPrefix}-expired-reg`,
        state: "REGISTRATION_OPEN",
        registrationEnd: pastDate,
      },
    });
    createdEventIds.push(event.id);

    const participant = await prisma.user.create({
      data: {
        email: `${testPrefix}-part3@example.com`,
        name: "Participant Three",
      },
    });
    createdUserIds.push(participant.id);

    await expect(
      registrationService.registerForEvent(participant.id, event.id)
    ).rejects.toThrow(ValidationError);
  });

  it("rejects duplicate registration for the same event", async () => {
    const organizer = await prisma.user.create({
      data: {
        email: `${testPrefix}-org4@example.com`,
        name: "Organizer Four",
      },
    });
    createdUserIds.push(organizer.id);

    const event = await eventService.createEvent(
      {
        name: "Duplicate Test Hack",
        slug: `${testPrefix}-dup-hack`,
      },
      organizer.id
    );
    createdEventIds.push(event.id);
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);

    const participant = await prisma.user.create({
      data: {
        email: `${testPrefix}-part4@example.com`,
        name: "Participant Four",
      },
    });
    createdUserIds.push(participant.id);

    // First registration succeeds
    await registrationService.registerForEvent(participant.id, event.id);

    // Second registration throws ConflictError
    await expect(
      registrationService.registerForEvent(participant.id, event.id)
    ).rejects.toThrow(ConflictError);
  });

  it("allows participant to cancel their registration and re-register", async () => {
    const organizer = await prisma.user.create({
      data: {
        email: `${testPrefix}-org5@example.com`,
        name: "Organizer Five",
      },
    });
    createdUserIds.push(organizer.id);

    const event = await eventService.createEvent(
      {
        name: "Cancellation Test Hack",
        slug: `${testPrefix}-cancel-hack`,
      },
      organizer.id
    );
    createdEventIds.push(event.id);
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);

    const participant = await prisma.user.create({
      data: {
        email: `${testPrefix}-part5@example.com`,
        name: "Participant Five",
      },
    });
    createdUserIds.push(participant.id);

    await registrationService.registerForEvent(participant.id, event.id);

    // Cancel registration
    const result = await registrationService.cancelRegistration(participant.id, event.id);
    expect(result.success).toBe(true);

    // Active participants query should now be empty
    const participants = await registrationService.listParticipants(event.id);
    expect(participants.length).toBe(0);

    // Re-registration should succeed
    const reactivated = await registrationService.registerForEvent(participant.id, event.id);
    expect(reactivated.status).toBe("ACTIVE");
  });
});
