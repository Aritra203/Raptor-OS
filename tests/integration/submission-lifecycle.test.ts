import { describe, it, expect, afterAll } from "vitest";
import { submissionService } from "@/server/services/submission.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors/app-error";

describe("Submission Lifecycle Integration Tests (Phase 5)", () => {
  const testPrefix = `test-sub-life-${Date.now()}`;
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

  async function setupEventAndTeam() {
    const organizer = await createTestUser("organizer");
    const captain = await createTestUser("captain");

    const event = await eventService.createEvent(
      {
        name: `Lifecycle Hackathon ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-evt-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 1,
        maxTeamSize: 4,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    // Transition to REGISTRATION_OPEN, register captain, form team
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: `Team Rocket ${Math.random().toString(36).substring(2, 7)}`,
      },
      captain.id
    );

    // Transition event to SUBMISSIONS_OPEN
    await eventService.transitionEvent(event.id, "REGISTRATION_CLOSED", organizer.id);
    await eventService.transitionEvent(event.id, "SUBMISSIONS_OPEN", organizer.id);

    return { organizer, captain, event, team };
  }

  it("progresses through complete lifecycle: draft -> edit -> submit -> lock -> disqualify -> restore", async () => {
    const { organizer, captain, event, team } = await setupEventAndTeam();

    // 1. Create Draft (userId, eventId, input)
    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Project Phoenix Initial Draft",
        description: "Initial description for Phoenix project.",
      }
    );

    expect(draft.id).toBeDefined();
    expect(draft.state).toBe("DRAFT");
    expect(draft.title).toBe("Project Phoenix Initial Draft");
    expect(draft.versions).toHaveLength(1);
    expect(draft.versions[0]!.versionNumber).toBe(1);

    // 2. Edit Draft (userId, submissionId, input)
    const updated = await submissionService.updateDraft(
      captain.id,
      draft.id,
      {
        title: "Project Phoenix Revised",
        description: "An advanced offline distributed database system.",
        repositoryUrl: "https://github.com/phoenix/db",
        demoUrl: "https://phoenix.internal",
      }
    );

    expect(updated.title).toBe("Project Phoenix Revised");
    expect(updated.repositoryUrl).toBe("https://github.com/phoenix/db");
    expect(updated.state).toBe("DRAFT");

    // 3. Submit / Finalize (userId, submissionId)
    const submitted = await submissionService.finalizeSubmission(captain.id, draft.id);
    expect(submitted.state).toBe("SUBMITTED");
    expect(submitted.submittedAt).not.toBeNull();
    // Verify an immutable version snapshot was persisted
    expect(submitted.versions.length).toBeGreaterThanOrEqual(1);

    // 4. Organizer locks the submission (userId, submissionId)
    const locked = await submissionService.lockSubmission(organizer.id, draft.id);
    expect(locked.state).toBe("LOCKED");
    expect(locked.lockedAt).not.toBeNull();

    // 5. Verification that locked submission cannot be edited by captain
    await expect(
      submissionService.updateDraft(
        captain.id,
        draft.id,
        { title: "Unauthorized Post-Lock Edit" }
      )
    ).rejects.toThrow(ValidationError);

    // 6. Organizer disqualifies the submission with a reason (userId, submissionId, reason)
    const disqualified = await submissionService.disqualifySubmission(
      organizer.id,
      draft.id,
      "Violated hardware spectrum limits"
    );
    expect(disqualified.state).toBe("DISQUALIFIED");
    const customData = disqualified.customData as Record<string, unknown>;
    expect(customData?.disqualificationReason).toBe("Violated hardware spectrum limits");

    // 7. Organizer restores the submission back to SUBMITTED (userId, submissionId)
    const restored = await submissionService.restoreSubmission(organizer.id, draft.id);
    expect(restored.state).toBe("SUBMITTED");

    // 8. Verify audit logs recorded the lifecycle actions
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: draft.id },
      orderBy: { timestamp: "asc" },
    });

    const actions = auditLogs.map((log) => log.action);
    expect(actions).toContain("SUBMISSION_CREATED");
    expect(actions).toContain("SUBMISSION_SUBMITTED");
    expect(actions).toContain("SUBMISSION_LOCKED");
    expect(actions).toContain("SUBMISSION_DISQUALIFIED");
    expect(actions).toContain("SUBMISSION_RESTORED");
  }, 20000);
});
