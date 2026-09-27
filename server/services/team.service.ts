import crypto from "crypto";
import { teamRepository } from "@/server/repositories/team.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { registrationRepository } from "@/server/repositories/registration.repository";
import { authRepository } from "@/server/repositories/auth.repository";
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/db/prisma";

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export class TeamService {
  /**
   * Formats a raw team name into a clean, URL-safe slug.
   */
  private formatSlug(rawName: string): string {
    const slug = rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || slug.length < 2) {
      throw new ValidationError("Team name must contain at least 2 alphanumeric characters.");
    }
    return slug;
  }

  /**
   * Retrieves team details by ID.
   */
  async getTeamById(teamId: string) {
    const team = await teamRepository.findTeamById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${teamId}' does not exist.`);
    }
    return team;
  }

  /**
   * Retrieves a user's team for a given event, if any.
   */
  async getUserTeamInEvent(userId: string, eventId: string) {
    return teamRepository.findUserTeamInEvent(userId, eventId);
  }

  /**
   * Lists all teams registered in an event.
   */
  async listTeamsInEvent(eventId: string) {
    return teamRepository.listTeamsInEvent(eventId);
  }

  /**
   * Creates a new team in an event with the creator as LEADER.
   */
  async createTeam(
    input: {
      eventId: string;
      name: string;
      slug?: string;
      description?: string | null;
      trackId?: string | null;
    },
    creatorUserId: string
  ) {
    // 1. Verify event exists
    const event = await eventRepository.findEventById(input.eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${input.eventId}' was not found.`);
    }

    // 2. Verify event lifecycle allows team creation
    const allowedStates = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SUBMISSIONS_OPEN"];
    if (!allowedStates.includes(event.state)) {
      throw new ValidationError(
        `Team creation is not allowed during the '${event.state}' stage of this event.`
      );
    }

    // 3. Verify user is registered as an active PARTICIPANT in this event
    const participant = await registrationRepository.findActiveParticipant(
      creatorUserId,
      input.eventId
    );
    if (!participant) {
      throw new ForbiddenError(
        "You must be registered as an active participant in this event to create a team."
      );
    }

    // 4. Verify user does not already belong to a team in this event
    const existingTeam = await teamRepository.findUserTeamInEvent(
      creatorUserId,
      input.eventId
    );
    if (existingTeam) {
      throw new ConflictError(
        `You are already a member of team '${existingTeam.name}' in this event.`
      );
    }

    // 5. Format and validate slug
    const slug = this.formatSlug(input.slug || input.name);

    // 6. Verify slug uniqueness within the event
    const duplicate = await teamRepository.findTeamBySlug(input.eventId, slug);
    if (duplicate) {
      throw new ConflictError(`A team with the name/slug '${slug}' already exists in this event.`);
    }

    // 7. Verify track belongs to event if provided
    if (input.trackId) {
      const track = event.tracks.find((t) => t.id === input.trackId);
      if (!track) {
        throw new ValidationError("The selected track does not belong to this event.");
      }
    }

    return teamRepository.createTeamWithLeader({
      eventId: input.eventId,
      creatorId: creatorUserId,
      name: input.name.trim(),
      slug,
      description: input.description,
      trackId: input.trackId,
    });
  }

  /**
   * Invites another participant to join a team.
   */
  async inviteMember(teamId: string, inviteeEmail: string, actorUserId: string) {
    const normalizedEmail = inviteeEmail.trim().toLowerCase();

    // 1. Verify team exists
    const team = await teamRepository.findTeamById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${teamId}' does not exist.`);
    }

    // 2. Verify actor is a member of this team
    const actorMember = team.members.find((m) => m.userId === actorUserId);
    if (!actorMember) {
      throw new ForbiddenError("Only members of this team can send invitations.");
    }

    // 3. Verify event state allows team modifications
    const allowedStates = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SUBMISSIONS_OPEN"];
    if (!allowedStates.includes(team.event.state)) {
      throw new ValidationError("Team invitations are locked for this event stage.");
    }

    // 4. Verify team capacity limit
    const currentMemberCount = team.members.length;
    if (currentMemberCount >= team.event.maxTeamSize) {
      throw new ValidationError(
        `Team has reached maximum capacity of ${team.event.maxTeamSize} members.`
      );
    }

    // 5. Verify invitee is a registered participant in this event
    const inviteeUser = await authRepository.findUserByEmail(normalizedEmail);
    if (!inviteeUser) {
      throw new NotFoundError(
        `No registered user found with email '${normalizedEmail}'. Participants must register first.`
      );
    }

    const inviteeMembership = await registrationRepository.findActiveParticipant(
      inviteeUser.id,
      team.eventId
    );
    if (!inviteeMembership) {
      throw new ValidationError(
        `User '${normalizedEmail}' is not registered as a participant in this event.`
      );
    }

    // 6. Verify invitee is not already on a team in this event
    const inviteeExistingTeam = await teamRepository.findUserTeamInEvent(
      inviteeUser.id,
      team.eventId
    );
    if (inviteeExistingTeam) {
      throw new ConflictError(
        `User '${normalizedEmail}' is already on team '${inviteeExistingTeam.name}' in this event.`
      );
    }

    // 7. Verify no existing pending invitation
    const pendingInvite = team.invitations.find(
      (inv) => inv.email === normalizedEmail && inv.status === "PENDING" && inv.expiresAt > new Date()
    );
    if (pendingInvite) {
      throw new ConflictError(`An active invitation for '${normalizedEmail}' is already pending.`);
    }

    // 8. Generate secure invitation token and hash
    const rawToken = generateInvitationToken();
    const tokenHash = hashInvitationToken(rawToken);

    // Invitation expires in 7 days or at event submissionsEnd, whichever is earlier
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiresAt =
      team.event.submissionsEnd && team.event.submissionsEnd < sevenDaysFromNow
        ? team.event.submissionsEnd
        : sevenDaysFromNow;

    const invitation = await teamRepository.createInvitation({
      teamId,
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      actorId: actorUserId,
      eventId: team.eventId,
    });

    return {
      invitation,
      rawToken, // Provided to caller so an invitation link can be displayed
    };
  }

  /**
   * Accepts a team invitation.
   */
  async acceptInvitation(invitationId: string, userId: string, userEmail: string) {
    const normalizedEmail = userEmail.trim().toLowerCase();

    const invitation = await teamRepository.findInvitationById(invitationId);
    if (!invitation) {
      throw new NotFoundError("Invitation not found.");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(`Invitation has already been ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt <= new Date()) {
      await teamRepository.updateInvitationStatus(
        invitation.id,
        "EXPIRED",
        userId,
        invitation.team.eventId
      );
      throw new ValidationError("This invitation has expired.");
    }

    if (invitation.email.toLowerCase() !== normalizedEmail) {
      throw new ForbiddenError("This invitation was sent to a different email address.");
    }

    // Check user doesn't already belong to a team in this event
    const existingTeam = await teamRepository.findUserTeamInEvent(
      userId,
      invitation.team.eventId
    );
    if (existingTeam) {
      throw new ConflictError(
        `You already belong to team '${existingTeam.name}' in this event.`
      );
    }

    // Atomic transaction checking capacity and creating membership
    return prisma.$transaction(async (tx) => {
      // Re-check live capacity to avoid concurrency race condition
      const liveMemberCount = await tx.teamMember.count({
        where: { teamId: invitation.teamId },
      });

      if (liveMemberCount >= invitation.team.event.maxTeamSize) {
        throw new ValidationError(
          `This team has reached its maximum capacity of ${invitation.team.event.maxTeamSize} members.`
        );
      }

      // Mark invitation accepted
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Add user to team
      const member = await tx.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          role: "MEMBER",
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: userId,
          eventId: invitation.team.eventId,
          action: "TEAM_INVITATION_ACCEPTED",
          entityType: "TeamMember",
          entityId: member.id,
          metadata: {
            teamId: invitation.teamId,
            invitationId: invitation.id,
          },
        },
      });

      // Invalidate any other pending invitations for this user in this event
      await tx.teamInvitation.updateMany({
        where: {
          email: normalizedEmail,
          status: "PENDING",
          team: { eventId: invitation.team.eventId },
          id: { not: invitation.id },
        },
        data: { status: "REJECTED" },
      });

      return member;
    });
  }

  /**
   * Rejects a team invitation.
   */
  async rejectInvitation(invitationId: string, userId: string, userEmail: string) {
    const invitation = await teamRepository.findInvitationById(invitationId);
    if (!invitation) {
      throw new NotFoundError("Invitation not found.");
    }

    if (invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new ForbiddenError("This invitation was sent to a different email address.");
    }

    if (invitation.status !== "PENDING") {
      throw new ValidationError(`Invitation is already ${invitation.status.toLowerCase()}.`);
    }

    return teamRepository.updateInvitationStatus(
      invitation.id,
      "REJECTED",
      userId,
      invitation.team.eventId
    );
  }

  /**
   * Allows a user to leave a team.
   */
  async leaveTeam(teamId: string, userId: string) {
    const team = await teamRepository.findTeamById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${teamId}' was not found.`);
    }

    const member = team.members.find((m) => m.userId === userId);
    if (!member) {
      throw new NotFoundError("You are not a member of this team.");
    }

    if (team.submission) {
      throw new ValidationError(
        "Cannot leave a team that has already submitted a project for evaluation."
      );
    }

    // If leaving member is the LEADER
    if (member.role === "LEADER") {
      const remainingMembers = team.members.filter((m) => m.userId !== userId);
      if (remainingMembers.length > 0) {
        // Promote the next oldest member to LEADER
        const nextLeader = remainingMembers[0]!;
        await teamRepository.changeLeader(
          teamId,
          userId,
          nextLeader.userId,
          userId,
          team.eventId
        );
        await teamRepository.removeMember(teamId, userId, userId, team.eventId);
        return { success: true, message: `Left team. Leadership transferred to ${nextLeader.user.name}.` };
      } else {
        // Sole member leaving -> delete empty team
        await teamRepository.deleteTeam(teamId, userId, team.eventId);
        return { success: true, message: "Left team. Team has been disbanded." };
      }
    }

    // Regular member leaving
    await teamRepository.removeMember(teamId, userId, userId, team.eventId);
    return { success: true, message: "Successfully left the team." };
  }

  /**
   * Allows a team leader to remove a regular member.
   */
  async removeMember(teamId: string, targetUserId: string, actorUserId: string) {
    const team = await teamRepository.findTeamById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with ID '${teamId}' was not found.`);
    }

    const actorMember = team.members.find((m) => m.userId === actorUserId);
    if (!actorMember || actorMember.role !== "LEADER") {
      throw new ForbiddenError("Only the team captain can remove team members.");
    }

    const targetMember = team.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundError("The specified user is not a member of this team.");
    }

    if (targetMember.role === "LEADER") {
      throw new ValidationError("The team captain cannot be removed. Leadership must be transferred first.");
    }

    if (team.submission) {
      throw new ValidationError("Cannot remove members after a project has been submitted.");
    }

    await teamRepository.removeMember(teamId, targetUserId, actorUserId, team.eventId);
    return { success: true, message: "Member removed from team." };
  }

  /**
   * Lists all pending invitations for a user across all events.
   */
  async listUserPendingInvitations(userEmail: string) {
    return teamRepository.listUserPendingInvitations(userEmail);
  }
}

export const teamService = new TeamService();
