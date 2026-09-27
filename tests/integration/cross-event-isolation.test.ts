import { describe, it, expect, afterAll } from "vitest";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, ValidationError } from "@/lib/errors/app-error";

describe("Cross-Event Isolation Integration Tests (Phase 4)", () => {
  const testPrefix = `test-iso-${Date.now()}`;
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

  async function createTestUser(roleName: string) {
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}-${roleName}-${Math.random().toString(36).substring(2, 7)}@example.com`,
        name: `User ${roleName}`,
      },
    });
    createdUserIds.push(user.id);
    return user;
  }

  it("ensures tracks with identical slugs are permitted across different events but isolated", async () => {
    const orgA = await createTestUser("orgA");
    const orgB = await createTestUser("orgB");

    const eventA = await eventService.createEvent(
      { name: "Event Alpha", slug: `${testPrefix}-alpha` },
      orgA.id
    );
    const eventB = await eventService.createEvent(
      { name: "Event Beta", slug: `${testPrefix}-beta` },
      orgB.id
    );
    createdEventIds.push(eventA.id, eventB.id);

    // Create track with identical slug "web3" in both events
    const trackA = await eventService.createTrack(
      { eventId: eventA.id, name: "Web3 Innovation", slug: "web3" },
      orgA.id
    );
    const trackB = await eventService.createTrack(
      { eventId: eventB.id, name: "Web3 Applications", slug: "web3" },
      orgB.id
    );

    expect(trackA.id).not.toBe(trackB.id);
    expect(trackA.eventId).toBe(eventA.id);
    expect(trackB.eventId).toBe(eventB.id);

    // Verify tracks belong strictly to their respective events
    const fetchedA = await eventService.getEventById(eventA.id);
    const fetchedB = await eventService.getEventById(eventB.id);

    expect(fetchedA.tracks.length).toBe(1);
    expect(fetchedA.tracks[0]?.id).toBe(trackA.id);
    expect(fetchedB.tracks.length).toBe(1);
    expect(fetchedB.tracks[0]?.id).toBe(trackB.id);
  });

  it("prevents a user from creating a team in an event they are not registered in", async () => {
    const org = await createTestUser("org");
    const event = await eventService.createEvent(
      { name: "Isolation Hack", slug: `${testPrefix}-isolation-hack` },
      org.id
    );
    createdEventIds.push(event.id);
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", org.id);

    const unregisteredUser = await createTestUser("unregistered");

    // Unregistered user tries to create a team
    await expect(
      teamService.createTeam(
        {
          eventId: event.id,
          name: "Rogue Team",
        },
        unregisteredUser.id
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("prevents a team from inviting a user who is not registered for that specific event", async () => {
    const org = await createTestUser("org2");
    const eventA = await eventService.createEvent(
      { name: "Event Alpha 2", slug: `${testPrefix}-alpha-2` },
      org.id
    );
    const eventB = await eventService.createEvent(
      { name: "Event Beta 2", slug: `${testPrefix}-beta-2` },
      org.id
    );
    createdEventIds.push(eventA.id, eventB.id);

    await eventService.transitionEvent(eventA.id, "REGISTRATION_OPEN", org.id);
    await eventService.transitionEvent(eventB.id, "REGISTRATION_OPEN", org.id);

    const alice = await createTestUser("alice");
    const outsider = await createTestUser("outsider");

    // Alice registers for Event A
    await registrationService.registerForEvent(alice.id, eventA.id);
    // Outsider registers ONLY for Event B
    await registrationService.registerForEvent(outsider.id, eventB.id);

    const teamA = await teamService.createTeam(
      { eventId: eventA.id, name: "Event A Team" },
      alice.id
    );

    // Alice attempts to invite outsider to teamA (outsider is registered in eventB, NOT eventA)
    await expect(
      teamService.inviteMember(teamA.id, outsider.email, alice.id)
    ).rejects.toThrow(ValidationError);
  });

  it("allows teams with identical names across distinct events without conflict", async () => {
    const org = await createTestUser("org3");
    const event1 = await eventService.createEvent(
      { name: "Event One", slug: `${testPrefix}-one` },
      org.id
    );
    const event2 = await eventService.createEvent(
      { name: "Event Two", slug: `${testPrefix}-two` },
      org.id
    );
    createdEventIds.push(event1.id, event2.id);

    await eventService.transitionEvent(event1.id, "REGISTRATION_OPEN", org.id);
    await eventService.transitionEvent(event2.id, "REGISTRATION_OPEN", org.id);

    const user1 = await createTestUser("user1");
    const user2 = await createTestUser("user2");

    await registrationService.registerForEvent(user1.id, event1.id);
    await registrationService.registerForEvent(user2.id, event2.id);

    // Both users create a team named "Code Warriors" in their respective events
    const team1 = await teamService.createTeam(
      { eventId: event1.id, name: "Code Warriors" },
      user1.id
    );
    const team2 = await teamService.createTeam(
      { eventId: event2.id, name: "Code Warriors" },
      user2.id
    );

    expect(team1.slug).toBe("code-warriors");
    expect(team2.slug).toBe("code-warriors");
    expect(team1.id).not.toBe(team2.id);
    expect(team1.eventId).toBe(event1.id);
    expect(team2.eventId).toBe(event2.id);
  });
});
