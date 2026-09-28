import crypto from "crypto";
import { getServerEnv } from "@/lib/env/env";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/**
 * Generates a cryptographically random session token (32 bytes = 256 bits of entropy).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of a session token for secure database persistence.
 * Raw session tokens are never stored in the database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Computes the expiration date for a newly created or refreshed session.
 */
export function getSessionExpirationDate(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_MS);
}

/**
 * Resolves the configured auth cookie name.
 */
export function getAuthCookieName(): string {
  try {
    const env = getServerEnv();
    return env.AUTH_COOKIE_NAME || "raptoros_session";
  } catch {
    return "raptoros_session";
  }
}

/**
 * Builds standard secure cookie options for session token injection.
 */
export function buildSessionCookieOptions(token: string, isProduction: boolean = process.env.NODE_ENV === "production"): CookieOptions {
  return {
    name: getAuthCookieName(),
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Builds cookie options to clear/delete the session cookie.
 */
export function buildClearSessionCookieOptions(isProduction: boolean = process.env.NODE_ENV === "production"): CookieOptions {
  return {
    name: getAuthCookieName(),
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
