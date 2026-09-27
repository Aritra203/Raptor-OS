import { describe, it, expect } from "vitest";
import { sanitizeCommentContent } from "@/lib/utils/comment-sanitizer";
import { createCommentSchema } from "@/lib/validations/community";
import { ValidationError } from "@/lib/errors/app-error";

describe("Comment Sanitization & Validation (Phase 8)", () => {
  describe("Plain-Text Enforcement & XSS Stripping", () => {
    it("strips script tags and malicious payloads", () => {
      const malicious = '<script>alert("xss")</script>Great project!';
      const cleaned = sanitizeCommentContent(malicious);
      expect(cleaned).toBe("Great project!");
      expect(cleaned).not.toContain("<script>");
      expect(cleaned).not.toContain("alert");
    });

    it("strips nested HTML tags while preserving inner text", () => {
      const html = "<b>Awesome</b> work on the <i>offline-first</i> feature!";
      const cleaned = sanitizeCommentContent(html);
      expect(cleaned).toBe("Awesome work on the offline-first feature!");
    });

    it("removes dangerous event handlers and img tags", () => {
      const payload = '<img src=x onerror=alert(1)>Nice demo <a href="javascript:steal()">link</a>';
      const cleaned = sanitizeCommentContent(payload);
      expect(cleaned).not.toContain("<img");
      expect(cleaned).not.toContain("onerror");
      expect(cleaned).not.toContain("javascript:");
      expect(cleaned).toContain("Nice demo");
    });

    it("strips ASCII control characters while preserving standard newlines and tabs", () => {
      const dirty = "Line 1\x00\x07\x1B\nLine 2\tIndented";
      const cleaned = sanitizeCommentContent(dirty);
      expect(cleaned).toBe("Line 1\nLine 2\tIndented");
    });

    it("normalizes excessive carriage returns to standard newlines", () => {
      const windowsNewlines = "Hello\r\nWorld\r!";
      const cleaned = sanitizeCommentContent(windowsNewlines);
      expect(cleaned).toBe("Hello\nWorld\n!");
    });
  });

  describe("Comment Validation Bounds (2 - 1000 characters)", () => {
    it("accepts comments within valid length bounds", () => {
      const valid = "This is a great implementation!";
      const cleaned = sanitizeCommentContent(valid);
      expect(cleaned).toBe("This is a great implementation!");
      expect(createCommentSchema.safeParse({ content: valid }).success).toBe(true);
    });

    it("rejects empty comments or whitespace-only comments", () => {
      expect(() => sanitizeCommentContent("")).toThrow(ValidationError);
      expect(() => sanitizeCommentContent("   ")).toThrow(ValidationError);
      expect(createCommentSchema.safeParse({ content: "" }).success).toBe(false);
    });

    it("rejects comments shorter than 2 characters", () => {
      expect(() => sanitizeCommentContent("a")).toThrow(ValidationError);
      expect(sanitizeCommentContent("ok")).toBe("ok");
    });

    it("rejects comments exceeding 1000 characters", () => {
      const longComment = "a".repeat(1001);
      expect(() => sanitizeCommentContent(longComment)).toThrow(ValidationError);

      const maxValidComment = "a".repeat(1000);
      expect(sanitizeCommentContent(maxValidComment)).toHaveLength(1000);
    });

    it("trims outer whitespace before length checks", () => {
      const padded = "   Hello team!   ";
      const cleaned = sanitizeCommentContent(padded);
      expect(cleaned).toBe("Hello team!");
    });
  });
});
