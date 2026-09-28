import { ForbiddenError } from "@/lib/errors/app-error";

/**
 * Validates the origin of incoming state-changing HTTP mutations to protect against CSRF.
 * Self-contained, offline, without external tokens or cloud services.
 */
export function verifyRequestOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  // Safe HTTP methods do not require origin check
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host");

  if (!host) {
    return; // Fallback for direct testing environments where host header may be synthetic
  }

  const normalizedHost = host.toLowerCase().split(":")[0];

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.hostname.toLowerCase();

      // Permit if same hostname or both are localhost/loopback
      const isLoopback =
        (originHost === "localhost" || originHost === "127.0.0.1") &&
        (normalizedHost === "localhost" || normalizedHost === "127.0.0.1");

      if (originHost !== normalizedHost && !isLoopback) {
        throw new ForbiddenError(
          `Cross-origin mutation rejected. Request origin '${origin}' does not match host '${host}'.`
        );
      }
      return;
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      throw new ForbiddenError("Invalid origin header received.");
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname.toLowerCase();

      const isLoopback =
        (refererHost === "localhost" || refererHost === "127.0.0.1") &&
        (normalizedHost === "localhost" || normalizedHost === "127.0.0.1");

      if (refererHost !== normalizedHost && !isLoopback) {
        throw new ForbiddenError(
          `Cross-origin mutation rejected. Referer '${referer}' does not match host '${host}'.`
        );
      }
      return;
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      throw new ForbiddenError("Invalid referer header received.");
    }
  }

  // If neither origin nor referer is provided (e.g. programmatic API/test clients),
  // ambient session cookie authentication is already protected by SameSite=Lax.
}
