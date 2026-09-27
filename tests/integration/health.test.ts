import { describe, it, expect, vi, beforeEach } from "vitest";
import { systemService } from "@/server/services/system.service";
import { systemRepository } from "@/server/repositories/system.repository";
import { GET } from "@/app/api/health/route";
import { DatabaseError } from "@/lib/errors/app-error";

describe("Health Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns healthy status when database ping succeeds", async () => {
    vi.spyOn(systemRepository, "ping").mockResolvedValue(true);
    vi.spyOn(systemRepository, "findByKey").mockResolvedValue({
      key: "platform.version",
      value: "0.1.0-phase1",
      description: "Platform version",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const health = await systemService.getHealth();
    expect(health.status).toBe("ok");
    expect(health.service).toBe("raptoros");
    expect(health.database).toBe("ok");
    expect(health.version).toBe("0.1.0-phase1");
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws DatabaseError when database ping fails", async () => {
    vi.spyOn(systemRepository, "ping").mockRejectedValue(new Error("Connection refused"));

    await expect(systemService.getHealth()).rejects.toThrow(DatabaseError);
  });

  it("GET /api/health responds with 200 and healthy JSON when operational", async () => {
    vi.spyOn(systemService, "getHealth").mockResolvedValue({
      status: "ok",
      service: "raptoros",
      database: "ok",
      latencyMs: 4,
      version: "0.1.0-phase1",
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      status: "ok",
      service: "raptoros",
      database: "ok",
      latencyMs: 4,
      version: "0.1.0-phase1",
    });
  });

  it("GET /api/health responds with 503 and safe JSON when database is down", async () => {
    vi.spyOn(systemService, "getHealth").mockRejectedValue(
      new DatabaseError("The database is currently unavailable.")
    );

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The database is currently unavailable.",
      },
    });
    // Ensure no sensitive internal stack traces or connection details leak
    expect(body.error.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
