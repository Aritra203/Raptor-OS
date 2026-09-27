import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, sanitizeLogValue } from "@/lib/logger/logger";

describe("Logger", () => {
  describe("sanitizeLogValue", () => {
    it("redacts sensitive keys in objects", () => {
      const input = {
        username: "admin",
        password: "super_secret_password_123",
        token: "jwt.token.here",
        apiKey: "raptor_api_key_456",
        safeMeta: "all good",
      };

      const sanitized = sanitizeLogValue(input) as Record<string, unknown>;
      expect(sanitized.username).toBe("admin");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.safeMeta).toBe("all good");
    });

    it("redacts credentials inside database connection strings", () => {
      const url = "postgresql://raptor_user:super_secret_password@db.raptoros.internal:5432/raptordb";
      const sanitized = sanitizeLogValue(url);
      expect(sanitized).toBe("postgresql://raptor_user:[REDACTED]@db.raptoros.internal:5432/raptordb");
      expect(sanitized).not.toContain("super_secret_password");
    });

    it("handles nested arrays and objects recursively", () => {
      const input = {
        nested: {
          secret: "hidden_token",
          list: [{ password: "123" }, "clean_string"],
        },
      };

      const sanitized = sanitizeLogValue(input) as {
        nested: { secret: string; list: [Record<string, unknown>, string] };
      };
      expect(sanitized.nested.secret).toBe("[REDACTED]");
      expect(sanitized.nested.list[0].password).toBe("[REDACTED]");
      expect(sanitized.nested.list[1]).toBe("clean_string");
    });
  });

  describe("Logger methods", () => {
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs info message with structured metadata", () => {
      const testLogger = new Logger("test-service");
      testLogger.info("Server started", { port: 3000 });

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const loggedStr = (consoleInfoSpy.mock.calls[0]?.[0] as string) || "";
      const parsed = JSON.parse(loggedStr);

      expect(parsed.level).toBe("info");
      expect(parsed.service).toBe("test-service");
      expect(parsed.message).toBe("Server started");
      expect(parsed.meta).toEqual({ port: 3000 });
      expect(parsed.timestamp).toBeDefined();
    });

    it("logs warn message with structured metadata", () => {
      const testLogger = new Logger("test-service");
      testLogger.warn("High memory usage", { memoryMb: 1024 });

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const loggedStr = (consoleWarnSpy.mock.calls[0]?.[0] as string) || "";
      const parsed = JSON.parse(loggedStr);

      expect(parsed.level).toBe("warn");
      expect(parsed.message).toBe("High memory usage");
      expect(parsed.meta).toEqual({ memoryMb: 1024 });
    });

    it("logs error with sanitized error object", () => {
      const testLogger = new Logger("test-service");
      const error = new Error("Database timeout");
      testLogger.error("Health probe failed", error, { password: "leaked_pass" });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedStr = (consoleErrorSpy.mock.calls[0]?.[0] as string) || "";
      const parsed = JSON.parse(loggedStr);

      expect(parsed.level).toBe("error");
      expect(parsed.error.message).toBe("Database timeout");
      expect(parsed.meta.password).toBe("[REDACTED]");
    });
  });
});
