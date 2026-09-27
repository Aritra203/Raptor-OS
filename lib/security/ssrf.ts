import { ValidationError } from "@/lib/errors/app-error";

/**
 * Options for SSRF validation.
 */
export interface SsrfValidationOptions {
  /**
   * If true, allows loopback and private IPv4/IPv6 addresses (for local testing/isolated dev).
   * Defaults to reading RAPTOR_ALLOW_LOCAL_WEBHOOKS environment variable.
   */
  allowPrivate?: boolean;
}

/**
 * Common prohibited infrastructure ports to prevent internal service abuse.
 */
const PROHIBITED_PORTS = new Set([
  22,   // SSH
  23,   // Telnet
  25,   // SMTP
  110,  // POP3
  143,  // IMAP
  5432, // PostgreSQL
  6379, // Redis
  27017,// MongoDB
  3306, // MySQL
  2375, // Docker plain
  2376, // Docker TLS
  9200, // Elasticsearch
]);

/**
 * Known cloud metadata and internal hostnames.
 */
const PROHIBITED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
  "169.254.169.254",            // AWS/Azure/GCP metadata
  "metadata.google.internal",   // GCP metadata
  "instance-data",              // Cloud-init metadata
  "postgres",                   // Docker service name
  "db",                         // Docker service name
  "raptoros-postgres",          // Docker container name
  "host.docker.internal",       // Docker host gateway
  "gateway.docker.internal",    // Docker gateway
  "kubernetes.default",         // K8s service
]);

/**
 * Helper to check if an IPv4 address falls within private/reserved ranges.
 * RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * RFC 3927: 169.254.0.0/16 (Link-local)
 * RFC 5735: 127.0.0.0/8 (Loopback), 0.0.0.0/8 (Current network)
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined) {
    return false;
  }

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local / cloud metadata)
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Helper to check if an IPv6 address falls within private/local ranges.
 */
function isPrivateIpv6(ip: string): boolean {
  const cleanIp = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;
  // Unique local addresses fc00::/7
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
  // Link-local fe80::/10
  if (cleanIp.startsWith("fe8") || cleanIp.startsWith("fe9") || cleanIp.startsWith("fea") || cleanIp.startsWith("feb")) return true;

  return false;
}

/**
 * Validates a target URL against Server-Side Request Forgery (SSRF) risks.
 * Ensures the destination protocol is HTTP/HTTPS, rejects cloud metadata endpoints,
 * private network ranges, dangerous ports, and internal container hostnames.
 *
 * @param url Target destination URL string
 * @param options Configuration options
 * @returns boolean true if valid
 * @throws ValidationError if URL is invalid or violates SSRF protection policy
 */
export function validateWebhookUrl(
  url: string,
  options?: SsrfValidationOptions
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError("Invalid webhook URL format.");
  }

  // 1. Protocol validation: strictly http: or https:
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(
      `Unsupported webhook protocol '${parsed.protocol}'. Only http: and https: are allowed.`
    );
  }

  // 2. Reject credentials in URL (e.g. http://user:pass@host)
  if (parsed.username || parsed.password) {
    throw new ValidationError(
      "Webhook URLs must not contain embedded user credentials."
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject cloud metadata and internal infrastructure services unconditionally
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data"
  ) {
    throw new ValidationError(
      "Webhook destination violates SSRF protection policy: Cloud metadata endpoints are forbidden."
    );
  }

  // 4. Port validation
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (PROHIBITED_PORTS.has(portNum)) {
      throw new ValidationError(
        `Webhook destination violates SSRF protection policy: Port ${portNum} is not permitted.`
      );
    }
  }

  // 5. Determine whether private/loopback destinations are permitted
  const allowPrivate =
    options?.allowPrivate ??
    (process.env.RAPTOR_ALLOW_LOCAL_WEBHOOKS === "true" ||
      process.env.NODE_ENV === "test");

  if (!allowPrivate) {
    // Check known internal hostnames
    if (PROHIBITED_HOSTNAMES.has(hostname)) {
      throw new ValidationError(
        `Webhook destination violates SSRF protection policy: Internal destination '${hostname}' is prohibited.`
      );
    }

    // Check private IPv4 addresses
    if (isPrivateIpv4(hostname)) {
      throw new ValidationError(
        `Webhook destination violates SSRF protection policy: Private IP range '${hostname}' is prohibited.`
      );
    }

    // Check private IPv6 addresses
    if (isPrivateIpv6(hostname)) {
      throw new ValidationError(
        `Webhook destination violates SSRF protection policy: Private IPv6 address '${hostname}' is prohibited.`
      );
    }
  }

  return true;
}

/**
 * Safe boolean check version that does not throw.
 */
export function isSafeWebhookUrl(
  url: string,
  options?: SsrfValidationOptions
): boolean {
  try {
    return validateWebhookUrl(url, options);
  } catch {
    return false;
  }
}
