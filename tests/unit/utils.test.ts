import { describe, it, expect } from "vitest";
import { cn, formatDate } from "@/lib/utils";

describe("Utils", () => {
  describe("cn", () => {
    it("merges class names correctly", () => {
      const result = cn("text-red-500", "p-4");
      expect(result).toBe("text-red-500 p-4");
    });

    it("resolves Tailwind conflicts in favor of latter classes", () => {
      const result = cn("p-2", "p-4");
      expect(result).toBe("p-4");
    });

    it("handles conditionals and falsey values cleanly", () => {
      const isHidden = false;
      const isActive = true;
      const result = cn("base", isHidden && "hidden", isActive && "active");
      expect(result).toBe("base active");
    });
  });

  describe("formatDate", () => {
    it("formats a valid date into ISO string", () => {
      const date = new Date("2026-01-01T00:00:00.000Z");
      expect(formatDate(date)).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns 'Invalid Date' for malformed date inputs", () => {
      expect(formatDate("not-a-date")).toBe("Invalid Date");
    });
  });
});
