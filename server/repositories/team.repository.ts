import { prisma } from "@/lib/db/prisma";
import type { Team, TeamMember, TeamInvitation, InvitationStatus, TeamMemberRole } from "@prisma/client";

export class TeamRepository {
  /**
   * Finds a team by its ID with full member details, track, and invitations.
   */
  async findTeamById(teamId: string) {
    return prisma.team.findUnique({
      where: { id: teamId },
      include: {
        event: true,
        track: true,
        creator: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        invitations: {
          orderBy: { createdAt: "desc" },
        },
        submission: {
          select: { id: true, title: true, state: true },
        },
      },
    });
  }

  /**
   * Finds a team by slug within an event.
   */
  async findTeamBySlug(eventId: string, slug: string): Promise<Team | null> {
    return prisma.team.findUnique({
      where: {
        eventId_slug: { eventId, slug },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  /**
   * Finds the team that a specific user currently belongs to within a specific event.
   */
  async findUserTeamInEvent(userId: string, eventId: string) {
    return prisma.team.findFirst({
      where: {
        eventId,
        members: {
          some: { userId },
        },
      },
      include: {
        event: true,
        track: true,
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        invitations: {
          where: { status: "PENDING" },
        },
        submission: true,
      },
    });
  }

  /**
   * Lists all teams in an event.
   */
  async listTeamsInEvent(eventId: string) {
    return prisma.team.findMany({
      where: { eventId },
      include: {
        track: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Creates a team and sets the creator as LEADER in an atomic transaction.
   */
  async createTeamWithLeader(data: {
    eventId: string;
    creatorId: string;
    name: string;
    slug: string;
    description?: string | null;
    trackId?: string | null;
  }): Promise<Team & { members: TeamMember[] }> {
    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          eventId: data.eventId,
          creatorId: data.creatorId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          trackId: data.trackId || null,
        },
      });

      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: data.creatorId,
          role: "LEADER",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: data.creatorId,
          eventId: data.eventId,
          action: "TEAM_CREATED",
          entityType: "Team",
          entityId: team.id,
          metadata: {
            name: team.name,
            slug: team.slug,
          },
        },
      });

      return tx.team.findUniqueOrThrow({
        where: { id: team.id },
        include: { members: true },
      });
    });
  }

  /**
   * Adds a member to a team.
   */
  async addMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole = "MEMBER",
    eventId: string
  ): Promise<TeamMember> {
    return prisma.$transaction(async (tx) => {
      const member = await tx.teamMember.create({
        data: {
          teamId,
          userId,
          role,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          eventId,
          action: "TEAM_MEMBER_JOINED",
          entityType: "TeamMember",
          entityId: member.id,
          metadata: {
            teamId,
            userId,
            role,
          },
        },
      });

      return member;
    });
  }

  /**
   * Removes a member from a team.
   */
  async removeMember(
    teamId: string,
    userId: string,
    actorId: string,
    eventId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: {
          teamId_userId: { teamId, userId },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "TEAM_MEMBER_REMOVED",
          entityType: "Team",
          entityId: teamId,
          metadata: {
            removedUserId: userId,
          },
        },
      });
    });
  }

  /**
   * Changes the team leader.
   */
  async changeLeader(
    teamId: string,
    currentLeaderId: string,
    newLeaderId: string,
    actorId: string,
    eventId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Demote current leader
      await tx.teamMember.update({
        where: { teamId_userId: { teamId, userId: currentLeaderId } },
        data: { role: "MEMBER" },
      });

      // Promote new leader
      await tx.teamMember.update({
        where: { teamId_userId: { teamId, userId: newLeaderId } },
        data: { role: "LEADER" },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "TEAM_LEADER_CHANGED",
          entityType: "Team",
          entityId: teamId,
          metadata: {
            previousLeader: currentLeaderId,
            newLeader: newLeaderId,
          },
        },
      });
    });
  }

  /**
   * Deletes a team.
   */
  async deleteTeam(teamId: string, actorId: string, eventId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.team.delete({ where: { id: teamId } });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "TEAM_DELETED",
          entityType: "Team",
          entityId: teamId,
        },
      });
    });
  }

  /**
   * Creates a team invitation storing the token hash.
   */
  async createInvitation(data: {
    teamId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
    actorId: string;
    eventId: string;
  }): Promise<TeamInvitation> {
    return prisma.$transaction(async (tx) => {
      const invitation = await tx.teamInvitation.create({
        data: {
          teamId: data.teamId,
          email: data.email,
          token: data.tokenHash, // Stores SHA-256 token hash
          status: "PENDING",
          expiresAt: data.expiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: data.actorId,
          eventId: data.eventId,
          action: "TEAM_INVITATION_CREATED",
          entityType: "TeamInvitation",
          entityId: invitation.id,
          metadata: {
            teamId: data.teamId,
            inviteeEmail: data.email,
            // Do NOT log token or hash
          },
        },
      });

      return invitation;
    });
  }

  /**
   * Finds an invitation by ID.
   */
  async findInvitationById(id: string) {
    return prisma.teamInvitation.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            event: true,
            members: true,
          },
        },
      },
    });
  }

  /**
   * Finds an invitation by token hash.
   */
  async findInvitationByTokenHash(tokenHash: string) {
    return prisma.teamInvitation.findUnique({
      where: { token: tokenHash },
      include: {
        team: {
          include: {
            event: true,
            members: true,
          },
        },
      },
    });
  }

  /**
   * Updates an invitation's status (e.g. ACCEPTED, REJECTED, EXPIRED).
   */
  async updateInvitationStatus(
    id: string,
    status: InvitationStatus,
    actorId: string,
    eventId: string
  ): Promise<TeamInvitation> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.teamInvitation.update({
        where: { id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: `TEAM_INVITATION_${status}`,
          entityType: "TeamInvitation",
          entityId: id,
        },
      });

      return updated;
    });
  }

  /**
   * Lists all pending invitations for a user by email.
   */
  async listUserPendingInvitations(email: string) {
    return prisma.teamInvitation.findMany({
      where: {
        email: email.trim().toLowerCase(),
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        team: {
          include: {
            event: { select: { id: true, name: true, slug: true } },
            creator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const teamRepository = new TeamRepository();
