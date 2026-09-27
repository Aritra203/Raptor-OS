import { describe, it, expect, afterAll } from "vitest";
import { galleryService } from "@/server/services/gallery.service";
import { submissionService } from "@/server/services/submission.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

describe("Public Gallery Query & Filtering Integration Tests (Phase 5)", () => {
  const testPrefix = `test-gal-${Date.now()}`;
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

  it("filters gallery visibility: includes SUBMITTED & LOCKED, strictly excludes DRAFT & DISQUALIFIED", async () => {
    const organizer = await createTestUser("organizer");
    const captain1 = await createTestUser("captain1");
    const captain2 = await createTestUser("captain2");
    const captain3 = await createTestUser("captain3");
    const captain4 = await createTestUser("captain4");

    const event = await eventService.createEvent(
      {
        name: `Gallery Showcase ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-showcase-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 1,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    const track = await eventService.createTrack(
      {
        eventId: event.id,
        name: "Autonomous Systems",
        slug: "autonomous-systems",
      },
      organizer.id
    );

    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain1.id, event.id);
    await registrationService.registerForEvent(captain2.id, event.id);
    await registrationService.registerForEvent(captain3.id, event.id);
    await registrationService.registerForEvent(captain4.id, event.id);

    const t1 = await teamService.createTeam({ eventId: event.id, name: "Team One", trackId: track.id }, captain1.id);
    const t2 = await teamService.createTeam({ eventId: event.id, name: "Team Two", trackId: track.id }, captain2.id);
    const t3 = await teamService.createTeam({ eventId: event.id, name: "Team Three" }, captain3.id);
    const t4 = await teamService.createTeam({ eventId: event.id, name: "Team Four" }, captain4.id);

    await eventService.transitionEvent(event.id, "REGISTRATION_CLOSED", organizer.id);
    await eventService.transitionEvent(event.id, "SUBMISSIONS_OPEN", organizer.id);

    // 1. DRAFT Project (userId, eventId, input)
    const subDraft = await submissionService.createDraft(
      captain1.id,
      event.id,
      { teamId: t1.id, title: "Secret Stealth Project", description: "Still under construction." }
    );

    // 2. SUBMITTED Project
    const subSubmitted = await submissionService.createDraft(
      captain2.id,
      event.id,
      {
        teamId: t2.id,
        trackId: track.id,
        title: "Autonomous Drone Swarm",
        description: "Decentralized mesh routing for autonomous quadcopters.",
        repositoryUrl: "https://github.com/drones/swarm",
        demoUrl: "https://drones.internal",
      }
    );
    await submissionService.finalizeSubmission(captain2.id, subSubmitted.id);

    // 3. LOCKED Project
    const subLocked = await submissionService.createDraft(
      captain3.id,
      event.id,
      {
        teamId: t3.id,
        title: "Deterministic Cryptographic Ledger",
        description: "High speed ledger verified with zk-proofs.",
      }
    );
    await submissionService.finalizeSubmission(captain3.id, subLocked.id);
    await submissionService.lockSubmission(organizer.id, subLocked.id);

    // 4. DISQUALIFIED Project
    const subDisq = await submissionService.createDraft(
      captain4.id,
      event.id,
      { teamId: t4.id, title: "Malicious Packet Generator", description: "Bypasses firewalls." }
    );
    await submissionService.finalizeSubmission(captain4.id, subDisq.id);
    await submissionService.disqualifySubmission(organizer.id, subDisq.id, "Rule violation");

    // Query gallery scoped to this event
    const gallery = await galleryService.getPublicGallery({ eventId: event.id });
    const titles = gallery.items.map((i) => i.title);

    // Assert visible
    expect(titles).toContain("Autonomous Drone Swarm");
    expect(titles).toContain("Deterministic Cryptographic Ledger");

    // Assert strictly omitted
    expect(titles).not.toContain("Secret Stealth Project");
    expect(titles).not.toContain("Malicious Packet Generator");

    // Search filter
    const searchResult = await galleryService.getPublicGallery({
      eventId: event.id,
      search: "quadcopters",
    });
    expect(searchResult.items).toHaveLength(1);
    expect(searchResult.items[0]!.title).toBe("Autonomous Drone Swarm");

    // Track filter
    const trackResult = await galleryService.getPublicGallery({
      eventId: event.id,
      trackId: track.id,
    });
    expect(trackResult.items).toHaveLength(1);
    expect(trackResult.items[0]!.title).toBe("Autonomous Drone Swarm");

    // Detail lookup assertions
    const publicDetail = await galleryService.getPublicSubmission(subSubmitted.id);
    expect(publicDetail.title).toBe("Autonomous Drone Swarm");
    expect(publicDetail.repositoryUrl).toBe("https://github.com/drones/swarm");

    // Attempting to lookup DRAFT or DISQUALIFIED via public endpoint throws 404
    await expect(galleryService.getPublicSubmission(subDraft.id)).rejects.toThrow(NotFoundError);
    await expect(galleryService.getPublicSubmission(subDisq.id)).rejects.toThrow(NotFoundError);
  }, 20000);
});
