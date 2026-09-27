import { describe, it, expect, afterAll } from "vitest";
import { submissionService } from "@/server/services/submission.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { teamService } from "@/server/services/team.service";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, ValidationError } from "@/lib/errors/app-error";

describe("Submission Constraints & Cross-Event Isolation (Phase 5)", () => {
  const testPrefix = `test-sub-const-${Date.now()}`;
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

  it("enforces single submission per team per event", async () => {
    const organizer = await createTestUser("organizer");
    const captain = await createTestUser("captain");

    const event = await eventService.createEvent(
      {
        name: `Single Submission Event ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-single-${Math.random().toString(36).substring(2, 7)}`,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Solo Builders",
      },
      captain.id
    );

    // Create first draft
    await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Primary Submission",
        description: "Initial team submission.",
      }
    );

    // Attempt to create second draft for same team
    await expect(
      submissionService.createDraft(
        captain.id,
        event.id,
        {
          teamId: team.id,
          title: "Secondary Submission",
          description: "Illegal second project entry.",
        }
      )
    ).rejects.toThrow(ConflictError);
  });

  it("enforces minimum team size upon final submission", async () => {
    const organizer = await createTestUser("organizer2");
    const captain = await createTestUser("captain2");
    const member = await createTestUser("member2");

    // Event requiring at least 2 members
    const event = await eventService.createEvent(
      {
        name: `Min Team Event ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-minteam-${Math.random().toString(36).substring(2, 7)}`,
        minTeamSize: 2,
        maxTeamSize: 4,
      },
      organizer.id
    );
    createdEventIds.push(event.id);

    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, event.id);
    await registrationService.registerForEvent(member.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Understaffed Duo",
      },
      captain.id
    );

    await eventService.transitionEvent(event.id, "REGISTRATION_CLOSED", organizer.id);
    await eventService.transitionEvent(event.id, "SUBMISSIONS_OPEN", organizer.id);

    // Draft can be created with only 1 member
    const draft = await submissionService.createDraft(
      captain.id,
      event.id,
      {
        teamId: team.id,
        title: "Duo Project",
        description: "Project waiting for second teammate.",
      }
    );

    // Finalizing with only 1 member fails
    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow(ValidationError);
    await expect(
      submissionService.finalizeSubmission(captain.id, draft.id)
    ).rejects.toThrow("requires a minimum of 2 member");

    // Add second member
    const invite = await teamService.inviteMember(team.id, member.email, captain.id);
    await teamService.acceptInvitation(invite.invitation.id, member.id, member.email);

    // Finalizing now succeeds
    const submitted = await submissionService.finalizeSubmission(captain.id, draft.id);
    expect(submitted.state).toBe("SUBMITTED");
  });

  it("rejects track associations originating from a different event", async () => {
    const organizer = await createTestUser("organizer3");
    const captain = await createTestUser("captain3");

    // Event A
    const eventA = await eventService.createEvent(
      {
        name: `Event Alpha ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-alpha-${Math.random().toString(36).substring(2, 7)}`,
      },
      organizer.id
    );
    createdEventIds.push(eventA.id);

    // Event B with a track
    const eventB = await eventService.createEvent(
      {
        name: `Event Beta ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-beta-${Math.random().toString(36).substring(2, 7)}`,
      },
      organizer.id
    );
    createdEventIds.push(eventB.id);

    const trackB = await eventService.createTrack(
      {
        eventId: eventB.id,
        name: "Beta Exclusive Track",
        slug: "beta-exclusive-track",
      },
      organizer.id
    );

    await eventService.transitionEvent(eventA.id, "REGISTRATION_OPEN", organizer.id);
    await registrationService.registerForEvent(captain.id, eventA.id);

    const teamA = await teamService.createTeam(
      {
        eventId: eventA.id,
        name: "Team Alpha",
      },
      captain.id
    );

    // Attempt to create draft in Event A with track from Event B
    await expect(
      submissionService.createDraft(
        captain.id,
        eventA.id,
        {
          teamId: teamA.id,
          trackId: trackB.id,
          title: "Injected Track Project",
          description: "Cross-event injection test.",
        }
      )
    ).rejects.toThrow(ValidationError);
    await expect(
      submissionService.createDraft(
        captain.id,
        eventA.id,
        {
          teamId: teamA.id,
          trackId: trackB.id,
          title: "Injected Track Project",
          description: "Cross-event injection test.",
        }
      )
    ).rejects.toThrow("does not belong to this hackathon");
  });
});
