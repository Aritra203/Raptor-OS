import { describe, it, expect, afterAll } from "vitest";
import { submissionService } from "@/server/services/submission.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors/app-error";

describe("Submission Window & Deadline Integration Tests (Phase 5)", () => {
  const testPrefix = `test-sub-deadline-${Date.now()}`;
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

  it("blocks submission finalization when event submissions are not open", async () => {
    const organizer = await createTestUser("organizer");
    const captain = await createTestUser("captain");

    const event = await eventService.createEvent(
      {
        name: `Pre-submission Hackathon ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-presub-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 1,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    // Leave event in REGISTRATION_OPEN
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Early Birds",
      },
      captain.id
    );

    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Early Project",
        description: "Draft created before submission window opens.",
      }
    );

    // Attempt to finalize while still in REGISTRATION_OPEN
    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow(ValidationError);
    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow("Submissions are not currently open for this event");
  });

  it("blocks submission finalization when submissionsEnd deadline has elapsed", async () => {
    const organizer = await createTestUser("organizer2");
    const captain = await createTestUser("captain2");

    const event = await eventService.createEvent(
      {
        name: `Expired Deadline Hackathon ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-expired-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 1,
        submissionsEnd: new Date("2020-01-01T00:00:00Z"), // Past date
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Late Birds",
      },
      captain.id
    );

    await eventService.transitionEvent(event.id, "REGISTRATION_CLOSED", organizer.id);
    await eventService.transitionEvent(event.id, "SUBMISSIONS_OPEN", organizer.id);

    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Late Project",
        description: "Draft attempting to finalize after deadline.",
      }
    );

    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow(ValidationError);
    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow("deadline for this event has passed");
  });
});
