import { authRepository, type UserWithMemberships } from "@/server/repositories/auth.repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  generateSessionToken,
  hashSessionToken,
  getSessionExpirationDate,
} from "@/server/auth/session";
import { authRateLimiter } from "@/server/auth/rate-limiter";
import {
  ValidationError,
  UnauthorizedError,
  AppError,
} from "@/lib/errors/app-error";
import type { EventMembership, Session } from "@prisma/client";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  eventMemberships?: EventMembership[];
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  user: SafeUser;
  sessionToken: string;
  expiresAt: Date;
}

export class AuthService {
  // Rate limiting thresholds
  private readonly LOGIN_MAX_ATTEMPTS = 5;
  private readonly LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly REGISTER_MAX_ATTEMPTS = 10;
  private readonly REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Normalizes an email address according to RaptorOS policy:
   * Trims whitespace and converts to lowercase.
   */
  normalizeEmail(email: string): string {
    if (!email || typeof email !== "string") {
      return "";
    }
    return email.trim().toLowerCase();
  }

  /**
   * Converts a database User model into a sanitized SafeUser payload,
   * guaranteeing that password hashes and internal credentials never leak.
   */
  toSafeUser(user: UserWithMemberships): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      eventMemberships: user.eventMemberships,
    };
  }

  /**
   * Registers a new user account and creates an active session.
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const ip = input.ipAddress || "127.0.0.1";
    const rateLimitKey = `register:${ip}`;
    const maxAttempts =
      process.env.NODE_ENV === "production" ? this.REGISTER_MAX_ATTEMPTS : 500;
    const rateCheck = authRateLimiter.check(
      rateLimitKey,
      maxAttempts,
      this.REGISTER_WINDOW_MS
    );

    if (!rateCheck.allowed) {
      throw new AppError(
        `Too many registration requests. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        "FORBIDDEN",
        429
      );
    }

    const name = (input.name || "").trim();
    if (!name || name.length < 2) {
      throw new ValidationError("Name must be at least 2 characters long.");
    }

    const normalizedEmail = this.normalizeEmail(input.email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      throw new ValidationError("Please provide a valid email address.");
    }

    const password = input.password || "";
    if (password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters long.");
    }

    if (password !== input.confirmPassword) {
      throw new ValidationError("Passwords do not match.");
    }

    // Check if user already exists
    const existing = await authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new ValidationError("An account with this email address already exists.");
    }

    // Record registration attempt
    authRateLimiter.hit(rateLimitKey, this.REGISTER_WINDOW_MS);

    // Hash password with memory-hard scrypt
    const passwordHash = await hashPassword(password);

    // Create user in database
    const user = await authRepository.createUser({
      email: normalizedEmail,
      name,
      passwordHash,
    });

    // Create server-side session
    const rawSessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawSessionToken);
    const expiresAt = getSessionExpirationDate();

    await authRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    // Audit log registration (without credentials!)
    await authRepository.logAuditEvent({
      actorId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: normalizedEmail,
        ipAddress: input.ipAddress || null,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        eventMemberships: [],
      },
      sessionToken: rawSessionToken,
      expiresAt,
    };
  }

  /**
   * Authenticates a user with email and password, establishing an active session.
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const ip = input.ipAddress || "127.0.0.1";
    const normalizedEmail = this.normalizeEmail(input.email);
    const rateLimitKey = `login:${ip}:${normalizedEmail}`;
    const maxLoginAttempts =
      process.env.NODE_ENV === "production" ? this.LOGIN_MAX_ATTEMPTS : 500;

    const rateCheck = authRateLimiter.check(
      rateLimitKey,
      maxLoginAttempts,
      this.LOGIN_WINDOW_MS
    );

    if (!rateCheck.allowed) {
      throw new AppError(
        `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        "FORBIDDEN",
        429
      );
    }

    if (!normalizedEmail || !input.password) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const user = await authRepository.findUserByEmail(normalizedEmail);

    // If user does not exist, is deactivated, or has no password hash set
    if (!user || !user.isActive || !user.passwordHash) {
      authRateLimiter.hit(rateLimitKey, this.LOGIN_WINDOW_MS);
      await authRepository.logAuditEvent({
        action: "USER_LOGIN_FAILED",
        entityType: "User",
        entityId: normalizedEmail,
        metadata: {
          reason: "User not found or inactive",
          ipAddress: input.ipAddress || null,
        },
      });
      // Generic error response prevents account enumeration
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Verify password with constant-time scrypt comparison
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      authRateLimiter.hit(rateLimitKey, this.LOGIN_WINDOW_MS);
      await authRepository.logAuditEvent({
        actorId: user.id,
        action: "USER_LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          reason: "Password mismatch",
          ipAddress: input.ipAddress || null,
        },
      });
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Reset rate limiter on successful authentication
    authRateLimiter.reset(rateLimitKey);

    // Update last login timestamp
    await authRepository.updateLastLogin(user.id);

    // Generate secure session token
    const rawSessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawSessionToken);
    const expiresAt = getSessionExpirationDate();

    await authRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    // Fetch user with active memberships
    const userWithMemberships = await authRepository.findUserById(user.id);

    // Log successful login
    await authRepository.logAuditEvent({
      actorId: user.id,
      action: "USER_LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      metadata: {
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });

    return {
      user: this.toSafeUser(userWithMemberships || (user as UserWithMemberships)),
      sessionToken: rawSessionToken,
      expiresAt,
    };
  }

  /**
   * Logs out the current user by revoking the active session token.
   */
  async logout(sessionToken: string): Promise<void> {
    if (!sessionToken) {
      return;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const session = await authRepository.findSessionByTokenHash(tokenHash);

    if (session) {
      await authRepository.revokeSession(session.id);
      await authRepository.logAuditEvent({
        actorId: session.userId,
        action: "USER_LOGOUT",
        entityType: "Session",
        entityId: session.id,
      });
    }
  }

  /**
   * Validates a session token from request cookie and resolves the authenticated user.
   * Returns null if token is missing, expired, revoked, or user is inactive.
   */
  async validateSession(
    sessionToken: string
  ): Promise<{ user: SafeUser; session: Session } | null> {
    if (!sessionToken || typeof sessionToken !== "string") {
      return null;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const sessionWithUser = await authRepository.findSessionByTokenHash(tokenHash);

    if (!sessionWithUser) {
      return null;
    }

    // Check revocation and expiration
    if (sessionWithUser.isRevoked || sessionWithUser.expiresAt <= new Date()) {
      return null;
    }

    // Check user active status
    if (!sessionWithUser.user.isActive) {
      return null;
    }

    // Asynchronously update activity timestamp if more than 5 minutes have elapsed
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (sessionWithUser.lastActiveAt < fiveMinutesAgo) {
      authRepository.updateSessionActivity(sessionWithUser.id).catch(() => {});
    }

    const { user, ...session } = sessionWithUser;

    return {
      user: this.toSafeUser(user),
      session,
    };
  }
}

export const authService = new AuthService();
