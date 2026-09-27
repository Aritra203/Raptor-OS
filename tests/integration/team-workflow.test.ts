import { describe, it, expect, afterAll } from "vitest";
import { teamService, hashInvitationToken } from "@/server/services/team.service";
import { eventService } from "@/server/services/event.service";
import { registrationService } from "@/server/services/registration.service";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, ConflictError, ForbiddenError } from "@/lib/errors/app-error";

describe("Team Formation & Collaboration Workflow Integration Tests (Phase 4)", () => {
  const testPrefix = `test-team-${Date.now()}`;
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

  async function setupEvent(maxTeamSize = 3) {
    const organizer = await createTestUser("organizer");
    const event = await eventService.createEvent(
      {
        name: `Team Hackathon ${Math.random().toString(36).substring(2, 7)}`,
        slug: `${testPrefix}-hack-${Math.random().toString(36).substring(2, 7)}`,
        maxTeamSize,
      },
      organizer.id
    );
    createdEventIds.push(event.id);
    await eventService.transitionEvent(event.id, "REGISTRATION_OPEN", organizer.id);
    return { organizer, event };
  }

  it("creates a team with creator as LEADER and rejects creating a second team in same event", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    await registrationService.registerForEvent(alice.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Cyber Panthers",
        description: "Building cybersecurity tooling",
      },
      alice.id
    );

    expect(team.id).toBeDefined();
    expect(team.name).toBe("Cyber Panthers");
    expect(team.slug).toBe("cyber-panthers");
    expect(team.members.length).toBe(1);
    expect(team.members[0]?.userId).toBe(alice.id);
    expect(team.members[0]?.role).toBe("LEADER");

    // Attempting to create a second team in the same event should throw ConflictError
    await expect(
      teamService.createTeam(
        {
          eventId: event.id,
          name: "Second Team",
        },
        alice.id
      )
    ).rejects.toThrow(ConflictError);
  });

  it("handles invitations: token hashing, acceptance, and duplicate prevention", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    await registrationService.registerForEvent(alice.id, event.id);
    await registrationService.registerForEvent(bob.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Quantum Coders",
      },
      alice.id
    );

    // Alice invites Bob
    const { invitation, rawToken } = await teamService.inviteMember(team.id, bob.email, alice.id);
    expect(invitation.id).toBeDefined();
    expect(invitation.status).toBe("PENDING");
    expect(invitation.token).toBe(hashInvitationToken(rawToken));

    // Duplicate invite throws ConflictError
    await expect(
      teamService.inviteMember(team.id, bob.email, alice.id)
    ).rejects.toThrow(ConflictError);

    // Bob accepts invitation
    const member = await teamService.acceptInvitation(invitation.id, bob.id, bob.email);
    expect(member.userId).toBe(bob.id);
    expect(member.role).toBe("MEMBER");

    // Verify team roster now contains 2 members
    const updatedTeam = await teamService.getTeamById(team.id);
    expect(updatedTeam.members.length).toBe(2);
  });

  it("enforces maximum team capacity", async () => {
    // Event with maxTeamSize = 2
    const { event } = await setupEvent(2);
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    const charlie = await createTestUser("charlie");
    await registrationService.registerForEvent(alice.id, event.id);
    await registrationService.registerForEvent(bob.id, event.id);
    await registrationService.registerForEvent(charlie.id, event.id);

    const team = await teamService.createTeam(
      {
        eventId: event.id,
        name: "Duo Tech",
      },
      alice.id
    );

    // Add Bob to reach max size 2
    const { invitation } = await teamService.inviteMember(team.id, bob.email, alice.id);
    await teamService.acceptInvitation(invitation.id, bob.id, bob.email);

    // Now team has 2 members, trying to invite Charlie should fail capacity check
    await expect(
      teamService.inviteMember(team.id, charlie.email, alice.id)
    ).rejects.toThrow(ValidationError);
  });

  it("allows a regular member to leave team", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    await registrationService.registerForEvent(alice.id, event.id);
    await registrationService.registerForEvent(bob.id, event.id);

    const team = await teamService.createTeam({ eventId: event.id, name: "Alpha Team" }, alice.id);
    const { invitation } = await teamService.inviteMember(team.id, bob.email, alice.id);
    await teamService.acceptInvitation(invitation.id, bob.id, bob.email);

    // Bob leaves
    const leaveResult = await teamService.leaveTeam(team.id, bob.id);
    expect(leaveResult.success).toBe(true);

    const refreshed = await teamService.getTeamById(team.id);
    expect(refreshed.members.length).toBe(1);
    expect(refreshed.members[0]?.userId).toBe(alice.id);
  });

  it("transfers leadership when captain leaves a multi-member team", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    await registrationService.registerForEvent(alice.id, event.id);
    await registrationService.registerForEvent(bob.id, event.id);

    const team = await teamService.createTeam({ eventId: event.id, name: "Beta Team" }, alice.id);
    const { invitation } = await teamService.inviteMember(team.id, bob.email, alice.id);
    await teamService.acceptInvitation(invitation.id, bob.id, bob.email);

    // Alice (LEADER) leaves
    const leaveResult = await teamService.leaveTeam(team.id, alice.id);
    expect(leaveResult.success).toBe(true);

    const refreshed = await teamService.getTeamById(team.id);
    expect(refreshed.members.length).toBe(1);
    expect(refreshed.members[0]?.userId).toBe(bob.id);
    expect(refreshed.members[0]?.role).toBe("LEADER");
  });

  it("disbands team when sole member leaves", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    await registrationService.registerForEvent(alice.id, event.id);

    const team = await teamService.createTeam({ eventId: event.id, name: "Solo Team" }, alice.id);

    // Alice leaves
    const leaveResult = await teamService.leaveTeam(team.id, alice.id);
    expect(leaveResult.success).toBe(true);

    // Team should no longer exist
    const teamRecord = await prisma.team.findUnique({ where: { id: team.id } });
    expect(teamRecord).toBeNull();
  });

  it("enforces captain-only member removal", async () => {
    const { event } = await setupEvent();
    const alice = await createTestUser("alice");
    const bob = await createTestUser("bob");
    await registrationService.registerForEvent(alice.id, event.id);
    await registrationService.registerForEvent(bob.id, event.id);

    const team = await teamService.createTeam({ eventId: event.id, name: "Gamma Team" }, alice.id);
    const { invitation } = await teamService.inviteMember(team.id, bob.email, alice.id);
    await teamService.acceptInvitation(invitation.id, bob.id, bob.email);

    // Bob attempts to remove Alice (should fail: Bob is not leader)
    await expect(
      teamService.removeMember(team.id, alice.id, bob.id)
    ).rejects.toThrow(ForbiddenError);

    // Alice removes Bob
    const result = await teamService.removeMember(team.id, bob.id, alice.id);
    expect(result.success).toBe(true);

    const refreshed = await teamService.getTeamById(team.id);
    expect(refreshed.members.length).toBe(1);
  });
});
