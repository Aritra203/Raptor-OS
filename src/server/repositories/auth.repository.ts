import { prisma } from "@/lib/db/prisma";
import type { User, Session, EventMembership, Prisma } from "@prisma/client";

export type UserWithMemberships = User & {
  eventMemberships: EventMembership[];
};

export class AuthRepository {
  /**
   * Finds an active user by normalized email address.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Finds a user by ID including their event memberships.
   */
  async findUserById(id: string): Promise<UserWithMemberships | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        eventMemberships: {
          where: { status: "ACTIVE" },
        },
      },
    });
  }

  /**
   * Creates a new user record with a hashed password.
   */
  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        isActive: true,
      },
    });
  }

  /**
   * Updates a user's last login timestamp.
   */
  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Creates a new database session associated with a user.
   */
  async createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<Session> {
    return prisma.session.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        isRevoked: false,
      },
    });
  }

  /**
   * Finds a valid, non-revoked session by its SHA-256 token hash.
   */
  async findSessionByTokenHash(
    tokenHash: string
  ): Promise<(Session & { user: UserWithMemberships }) | null> {
    return prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            eventMemberships: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });
  }

  /**
   * Updates last active timestamp for a session.
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Revokes an active session.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revokes a session by token hash.
   */
  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await prisma.session.updateMany({
      where: { tokenHash, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revokes all active sessions for a specific user.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Finds all non-revoked sessions for a user.
   */
  async findActiveSessionsByUserId(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Appends an audit log entry for security and authentication tracking.
   */
  async logAuditEvent(data: {
    eventId?: string;
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          eventId: data.eventId,
          actorId: data.actorId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit log errors must never crash the primary auth flow
    }
  }
}

export const authRepository = new AuthRepository();
