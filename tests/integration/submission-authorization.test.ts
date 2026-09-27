import { describe, it, expect, afterAll } from "vitest";
import { submissionService } from "@/server/services/submission.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors/app-error";

describe("Submission Role & Authorization Integration Tests (Phase 5)", () => {
  const testPrefix = `test-sub-auth-${Date.now()}`;
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

  async function setupEnvironment() {
    const organizer = await createTestUser("organizer");
    const captain = await createTestUser("captain");
    const member = await createTestUser("member");
    const outsider = await createTestUser("outsider");

    const event = await eventService.createEvent(
      {
        name: `Auth Hackathon ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-auth-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 1,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);
    await registrationService.registerForEvent(member.id, event.id);
    await registrationService.registerForEvent(outsider.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Auth Protectors",
      },
      captain.id
    );

    // Add member to team
    const invite = await teamService.inviteMember(team.id, member.email, captain.id);
    await teamService.acceptInvitation(invite.invitation.id, member.id, member.email);

    await eventService.transitionEvent(event.id, "REGISTRATION_CLOSED", organizer.id);
    await eventService.transitionEvent(event.id, "SUBMISSIONS_OPEN", organizer.id);

    return { organizer, captain, member, outsider, event, team };
  }

  it("prevents non-captain team members and outsiders from updating or submitting drafts", async () => {
    const { captain, member, outsider, event, team } = await setupEnvironment();

    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Protected Project",
        description: "Initial description.",
      }
    );

    // Team member can collaboratively update draft
    const memberUpdated = await submissionService.updateDraft(
      member.id,
      draft.id,
      { title: "Member Collaboration Update" }
    );
    expect(memberUpdated.title).toBe("Member Collaboration Update");

    // Outsider cannot update draft
    await expect(
      submissionService.updateDraft(outsider.id, draft.id, { title: "Outsider Overwrite" })
    ).rejects.toThrow(ForbiddenError);

    // Non-captain team member cannot finalize submission (Captain-only action)
    await expect(
      submissionService.finalizeSubmission(member.id, draft.id)
    ).rejects.toThrow(ForbiddenError);

    // Outsider cannot finalize submission
    await expect(
      submissionService.finalizeSubmission(outsider.id, draft.id)
    ).rejects.toThrow(ForbiddenError);

    // Captain can successfully update and submit
    const updated = await submissionService.updateDraft(
      captain.id,
      draft.id,
      { title: "Captain Authorized Title" }
    );
    expect(updated.title).toBe("Captain Authorized Title");

    const submitted = await submissionService.finalizeSubmission(captain.id, draft.id);
    expect(submitted.state).toBe("SUBMITTED");
  });

  it("prevents non-organizers from locking or disqualifying submissions", async () => {
    const { organizer, captain, outsider, event, team } = await setupEnvironment();

    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Lockable Project",
        description: "Initial description.",
      }
    );
    await submissionService.finalizeSubmission(captain.id, draft.id);

    // Captain attempts to lock own submission
    await expect(
      submissionService.lockSubmission(captain.id, draft.id)
    ).rejects.toThrow(ForbiddenError);

    // Outsider attempts to lock
    await expect(
      submissionService.lockSubmission(outsider.id, draft.id)
    ).rejects.toThrow(ForbiddenError);

    // Captain attempts to disqualify
    await expect(
      submissionService.disqualifySubmission(captain.id, draft.id, "Self sabotage")
    ).rejects.toThrow(ForbiddenError);

    // Organizer can lock and disqualify
    const locked = await submissionService.lockSubmission(organizer.id, draft.id);
    expect(locked.state).toBe("LOCKED");

    const disqualified = await submissionService.disqualifySubmission(
      organizer.id,
      draft.id,
      "Organizer Disqualification"
    );
    expect(disqualified.state).toBe("DISQUALIFIED");
  });
});
