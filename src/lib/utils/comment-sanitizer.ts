import { ValidationError } from "@/lib/errors/app-error";

export interface SanitizeCommentOptions {
  minLength?: number;
  maxLength?: number;
}

/**
 * Strips all HTML tags and control sequences, enforcing safe plain text storage.
 * Completely eliminates XSS vectors without relying on heavy external libraries.
 */
export function sanitizeCommentContent(
  raw: string,
  options: SanitizeCommentOptions = {}
): string {
  const minLength = options.minLength ?? 2;
  const maxLength = options.maxLength ?? 1000;

  if (typeof raw !== "string") {
    throw new ValidationError("Comment content must be a string.");
  }

  // 1. Normalize line endings
  let clean = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Remove script/style tags and their inner content entirely
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 2. Strip all remaining HTML tags
  clean = clean.replace(/<\/?[a-z0-9]+(?:\s+[^>]*?)?\/?>/gi, "");

  // 3. Remove dangerous javascript: / vbscript: pseudo-protocols
  clean = clean.replace(/javascript\s*:/gi, "");
  clean = clean.replace(/data\s*:/gi, "");
  clean = clean.replace(/vbscript\s*:/gi, "");

  // 4. Strip non-printable ASCII control characters (keep newlines and tabs)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 5. Normalize consecutive whitespace (preserving single newlines)
  clean = clean
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();

  if (clean.length < minLength) {
    throw new ValidationError(
      `Comment is too short. It must contain at least ${minLength} characters of readable text.`
    );
  }

  if (clean.length > maxLength) {
    throw new ValidationError(
      `Comment exceeds the maximum allowed length of ${maxLength} characters.`
    );
  }

  return clean;
}
