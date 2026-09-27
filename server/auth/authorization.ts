import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { authService, type SafeUser } from "@/server/services/auth.service";
import { getAuthCookieName } from "@/server/auth/session";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors/app-error";
import type { EventRole, EventMembership, Session } from "@prisma/client";

export interface AuthenticatedContext {
  user: SafeUser;
  session: Session;
}

export interface EventScopedContext extends AuthenticatedContext {
  membership: EventMembership;
}

/**
 * Extracts the session token from a standard Request object or Next.js cookies context.
 */
export async function extractSessionToken(req?: Request): Promise<string | null> {
  const cookieName = getAuthCookieName();

  // 1. Check direct Request header if passed
  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const parsedCookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [key, ...v] = c.trim().split("=");
          return [key, decodeURIComponent(v.join("="))];
        })
      );
      const token =
        parsedCookies[cookieName] ||
        parsedCookies["session"] ||
        parsedCookies["auth_token"];
      if (token) {
        return token;
      }
    }
    // Also support Bearer authorization header for API clients / tests
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
  }

  // 2. Fall back to Next.js cookies store
  try {
    const cookieStore = await cookies();
    const sessionCookie =
      cookieStore.get(cookieName) ||
      cookieStore.get("session") ||
      cookieStore.get("auth_token");
    if (sessionCookie?.value) {
      return sessionCookie.value;
    }
  } catch {
    // cookies() may throw outside Next.js request lifecycle (e.g. in some test environments)
  }

  return null;
}

/**
 * Resolves the currently authenticated user and session, or returns null if unauthenticated.
 * Supports both standard session tokens and Bearer API keys (prefixed with 'rap_').
 */
export async function resolveSessionUser(
  req?: Request
): Promise<AuthenticatedContext | null> {
  const token = await extractSessionToken(req);
  if (!token) {
    return null;
  }

  // Support programmatic API Keys
  if (token.startsWith("rap_")) {
    const keyHash = crypto.createHash("sha256").update(token).digest("hex");
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          include: {
            eventMemberships: true,
          },
        },
      },
    });

    if (!apiKey || apiKey.isRevoked) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update lastUsedAt asynchronously without blocking
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      user: {
        id: apiKey.user.id,
        email: apiKey.user.email,
        name: apiKey.user.name,
        avatarUrl: apiKey.user.avatarUrl,
        bio: apiKey.user.bio,
        eventMemberships: apiKey.user.eventMemberships,
        createdAt: apiKey.user.createdAt,
        lastLoginAt: apiKey.user.lastLoginAt,
      },
      session: {
        id: `apikey_${apiKey.id}`,
        userId: apiKey.userId,
        tokenHash: apiKey.keyHash,
        expiresAt: apiKey.expiresAt || new Date(Date.now() + 365 * 86400000),
        lastActiveAt: new Date(),
        userAgent: "API Key",
        ipAddress: null,
        isRevoked: apiKey.isRevoked,
        revokedAt: apiKey.revokedAt,
        createdAt: apiKey.createdAt,
      } as Session,
    };
  }

  return authService.validateSession(token);
}

/**
 * Asserts that an active session exists. Throws 401 Unauthorized if not authenticated.
 */
export async function requireUser(req?: Request): Promise<AuthenticatedContext> {
  const auth = await resolveSessionUser(req);
  if (!auth) {
    throw new UnauthorizedError("Authentication is required to access this resource.");
  }
  return auth;
}

/**
 * Asserts that the authenticated user is an active member of the specified event.
 * Throws 401 if unauthenticated, 403 Forbidden if not a member of the event.
 */
export async function requireEventMember(
  eventId: string,
  req?: Request
): Promise<EventScopedContext> {
  if (!eventId) {
    throw new ForbiddenError("Event identifier is required for event-scoped authorization.");
  }

  const auth = await requireUser(req);

  let membership = auth.user.eventMemberships?.find(
    (m) => m.eventId === eventId && m.status === "ACTIVE"
  );

  // If not matched directly by eventId, resolve if eventId is actually a slug
  if (!membership) {
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: eventId }, { slug: eventId }],
      },
      select: { id: true },
    });
    if (event) {
      membership = auth.user.eventMemberships?.find(
        (m) => m.eventId === event.id && m.status === "ACTIVE"
      );
    }
  }

  if (!membership) {
    throw new ForbiddenError(
      "You are not an active member of this event. Access denied."
    );
  }

  return {
    ...auth,
    membership,
  };
}

/**
 * Event role hierarchy checker.
 * Checks whether user's role in the event satisfies the minimum required role.
 */
function isRoleSatisfied(userRole: EventRole, requiredRole: EventRole): boolean {
  if (userRole === requiredRole) {
    return true;
  }

  // Event ADMIN holds full management privileges within their specific event
  if (userRole === "ADMIN") {
    return true;
  }

  // Event ORGANIZER can access general event and judge resources within their event
  if (userRole === "ORGANIZER" && (requiredRole === "PARTICIPANT" || requiredRole === "JUDGE")) {
    return true;
  }

  return false;
}

/**
 * Enforces strict event-scoped role authorization.
 *
 * Example:
 *   requireEventRole(event1.id, "ORGANIZER")
 *
 * If User is ORGANIZER in Event 1 -> ALLOWED
 * If User is PARTICIPANT in Event 1 -> 403 FORBIDDEN
 * If User is ORGANIZER in Event 2, but PARTICIPANT in Event 1 -> 403 FORBIDDEN (strict event isolation!)
 */
export async function requireEventRole(
  eventId: string,
  requiredRole: EventRole,
  req?: Request
): Promise<EventScopedContext> {
  const scopedContext = await requireEventMember(eventId, req);

  if (!isRoleSatisfied(scopedContext.membership.role, requiredRole)) {
    throw new ForbiddenError(
      `Access denied. Role '${requiredRole}' is required for this event (your role is '${scopedContext.membership.role}').`
    );
  }

  return scopedContext;
}

/**
 * Enforces that user holds at least one of the allowed roles for the event.
 */
export async function requireAnyEventRole(
  eventId: string,
  allowedRoles: EventRole[],
  req?: Request
): Promise<EventScopedContext> {
  const scopedContext = await requireEventMember(eventId, req);

  const hasAllowedRole = allowedRoles.some((role) =>
    isRoleSatisfied(scopedContext.membership.role, role)
  );

  if (!hasAllowedRole) {
    throw new ForbiddenError(
      `Access denied. One of the following roles is required: [${allowedRoles.join(", ")}].`
    );
  }

  return scopedContext;
}
