import { prisma } from "@/lib/db/prisma";
import type { EventMembership, MembershipStatus, EventRole } from "@prisma/client";

export class RegistrationRepository {
  /**
   * Finds a user's membership in an event across all roles.
   */
  async findMembership(userId: string, eventId: string): Promise<EventMembership | null> {
    return prisma.eventMembership.findFirst({
      where: { userId, eventId },
      include: { event: true },
    });
  }

  /**
   * Finds a user's active PARTICIPANT membership in an event.
   */
  async findActiveParticipant(userId: string, eventId: string): Promise<EventMembership | null> {
    return prisma.eventMembership.findFirst({
      where: {
        userId,
        eventId,
        role: "PARTICIPANT",
        status: "ACTIVE",
      },
      include: { event: true },
    });
  }

  /**
   * Creates an event membership (default PARTICIPANT).
   */
  async createMembership(
    userId: string,
    eventId: string,
    role: EventRole = "PARTICIPANT"
  ): Promise<EventMembership> {
    return prisma.$transaction(async (tx) => {
      const membership = await tx.eventMembership.create({
        data: {
          userId,
          eventId,
          role,
          status: "ACTIVE",
        },
        include: {
          event: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          eventId,
          action: "PARTICIPANT_REGISTERED",
          entityType: "EventMembership",
          entityId: membership.id,
          metadata: {
            role,
          },
        },
      });

      return membership;
    });
  }

  /**
   * Updates a participant's membership status (e.g. SUSPENDED or INACTIVE).
   */
  async updateMembershipStatus(
    membershipId: string,
    status: MembershipStatus,
    actorId: string
  ): Promise<EventMembership> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.eventMembership.update({
        where: { id: membershipId },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: updated.eventId,
          action: "PARTICIPANT_STATUS_UPDATED",
          entityType: "EventMembership",
          entityId: membershipId,
          metadata: { newStatus: status },
        },
      });

      return updated;
    });
  }

  /**
   * Deletes / cancels a registration membership.
   */
  async deleteMembership(membershipId: string, actorId: string, eventId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.eventMembership.delete({ where: { id: membershipId } });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "PARTICIPANT_UNREGISTERED",
          entityType: "EventMembership",
          entityId: membershipId,
        },
      });
    });
  }

  /**
   * Lists all participants registered for an event.
   */
  async listEventParticipants(eventId: string) {
    return prisma.eventMembership.findMany({
      where: {
        eventId,
        role: "PARTICIPANT",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Lists all events a user is registered for.
   */
  async listUserRegistrations(userId: string) {
    return prisma.eventMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        event: {
          include: {
            tracks: { where: { isActive: true } },
            prizes: true,
            _count: {
              select: {
                memberships: { where: { role: "PARTICIPANT", status: "ACTIVE" } },
                teams: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const registrationRepository = new RegistrationRepository();
