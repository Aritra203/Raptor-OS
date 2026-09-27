import { describe, it, expect } from "vitest";
import { validateUrl, sanitizeText, createExcerpt } from "@/lib/utils/sanitizer";
import { ValidationError } from "@/lib/errors/app-error";

describe("URL Validator & Text Sanitizer (Unit Tests)", () => {
  describe("validateUrl", () => {
    it("accepts valid HTTPS URLs", () => {
      expect(validateUrl("https://github.com/raptoros/raptormesh")).toBe(
        "https://github.com/raptoros/raptormesh"
      );
      expect(validateUrl("https://example.com:8443/demo?ref=hackathon#overview")).toBe(
        "https://example.com:8443/demo?ref=hackathon#overview"
      );
    });

    it("accepts valid HTTP URLs for local offline testing", () => {
      expect(validateUrl("http://localhost:3000/demo")).toBe("http://localhost:3000/demo");
      expect(validateUrl("http://192.168.1.100:8080/app")).toBe("http://192.168.1.100:8080/app");
    });

    it("rejects javascript: schemes", () => {
      expect(() => validateUrl("javascript:alert(1)", "Repository URL")).toThrow(ValidationError);
      expect(() => validateUrl("javascript:alert(document.cookie)")).toThrow(
        "Only http:// and https:// links are permitted"
      );
    });

    it("rejects data: schemes", () => {
      expect(() => validateUrl("data:text/html,<script>alert(1)</script>")).toThrow(
        ValidationError
      );
    });

    it("rejects file: schemes", () => {
      expect(() => validateUrl("file:///etc/passwd")).toThrow(ValidationError);
      expect(() => validateUrl("file:///C:/Windows/System32")).toThrow(ValidationError);
    });

    it("rejects vbscript: schemes", () => {
      expect(() => validateUrl("vbscript:msgbox(1)")).toThrow(ValidationError);
    });

    it("rejects empty or whitespace-only URLs", () => {
      expect(() => validateUrl("   ")).toThrow(ValidationError);
      expect(() => validateUrl("")).toThrow("cannot be empty");
    });

    it("rejects invalid, malformed URL strings", () => {
      expect(() => validateUrl("not a url")).toThrow(ValidationError);
      expect(() => validateUrl("http://")).toThrow(ValidationError);
      expect(() => validateUrl("https:///invalid domain")).toThrow(ValidationError);
    });
  });

  describe("sanitizeText", () => {
    it("strips HTML tags completely", () => {
      const input = "<h1>Project Title</h1><p>This is a <script>alert(1)</script><strong>description</strong>.</p>";
      const sanitized = sanitizeText(input);
      expect(sanitized).toBe("Project TitleThis is a alert(1)description.");
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
    });

    it("removes dangerous unprintable control characters but preserves newlines", () => {
      const input = "Line 1\nLine 2\x00\x07\x1F\tLine 3";
      const sanitized = sanitizeText(input);
      expect(sanitized).toBe("Line 1\nLine 2\tLine 3");
    });

    it("handles empty strings", () => {
      expect(sanitizeText("")).toBe("");
    });
  });

  describe("createExcerpt", () => {
    it("returns the full sanitized string if within length", () => {
      const short = "Short description.";
      expect(createExcerpt(short, 50)).toBe("Short description.");
    });

    it("truncates and appends ellipsis if exceeds maximum length", () => {
      const longText = "A".repeat(200);
      const excerpt = createExcerpt(longText, 100);
      expect(excerpt.length).toBe(103); // 100 + "..."
      expect(excerpt.endsWith("...")).toBe(true);
    });
  });
});
