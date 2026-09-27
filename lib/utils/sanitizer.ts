import { ValidationError } from "@/lib/errors/app-error";

/**
 * Permitted URL schemes for external project links.
 * Restricts to https: and http: (for local/offline testing).
 * Strictly disallows dangerous schemes such as javascript:, data:, file:, vbscript:.
 */
const ALLOWED_URL_SCHEMES = new Set(["https:", "http:"]);

/**
 * Validates and normalizes an external URL.
 * Throws a ValidationError if the URL is syntactically invalid or uses an unauthorized protocol.
 */
export function validateUrl(url: string, fieldName = "URL"): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} cannot be empty.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError(`${fieldName} must be a valid, well-formed URL.`);
  }

  if (!ALLOWED_URL_SCHEMES.has(parsed.protocol)) {
    throw new ValidationError(
      `${fieldName} uses an unsupported scheme '${parsed.protocol}'. Only http:// and https:// links are permitted.`
    );
  }

  // Reject raw JavaScript payloads or encoded exploits in hostname/pathname
  const lowerHref = parsed.href.toLowerCase();
  if (
    lowerHref.includes("javascript:") ||
    lowerHref.includes("vbscript:") ||
    lowerHref.includes("data:")
  ) {
    throw new ValidationError(`${fieldName} contains forbidden script payloads.`);
  }

  return parsed.href;
}

/**
 * Sanitizes user-provided text by stripping HTML tags and control characters,
 * ensuring safe rendering as plain text or within sanitized layouts.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";

  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, "")
    // Strip dangerous control characters (preserve newlines, tabs, and carriage returns)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Generates an excerpt/snippet from a longer text description.
 */
export function createExcerpt(text: string, maxLength = 180): string {
  const sanitized = sanitizeText(text);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  return sanitized.slice(0, maxLength).trimEnd() + "...";
}
