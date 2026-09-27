import { describe, it, expect } from "vitest";
import {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  formatErrorResponse,
} from "@/lib/errors/app-error";

describe("AppError Hierarchy and Formatting", () => {
  it("creates AppError with correct properties", () => {
    const error = new AppError("Test error", "BAD_REQUEST", 400);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
  });

  it("DatabaseError defaults to 503 DATABASE_UNAVAILABLE", () => {
    const error = new DatabaseError();
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("DATABASE_UNAVAILABLE");
    expect(error.message).toBe("The database is currently unavailable.");
  });

  it("ValidationError sets 400 status and details", () => {
    const details = { field: "email", issue: "invalid" };
    const error = new ValidationError("Invalid input", details);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(details);
  });

  it("NotFoundError handles default and resource names", () => {
    const err1 = new NotFoundError();
    expect(err1.statusCode).toBe(404);
    expect(err1.message).toBe("Resource not found.");

    const err2 = new NotFoundError("Hackathon", "raptor-hack");
    expect(err2.statusCode).toBe(404);
    expect(err2.message).toBe("Hackathon 'raptor-hack' not found.");
  });

  it("toSafeResponse formats payload without stack traces or secrets", () => {
    const error = new DatabaseError("Database connection lost");
    const safePayload = error.toSafeResponse();

    expect(safePayload).toEqual({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection lost",
      },
    });
    expect((safePayload as unknown as Record<string, unknown>).stack).toBeUndefined();
  });

  it("formatErrorResponse returns safe fallback for unknown errors", async () => {
    const rawError = new Error("FATAL: relation postgres.users does not exist; password=secret");
    const response = formatErrorResponse(rawError);

    expect(response.status).toBe(500);
    const body = await response.json();
    // Raw message with sensitive secrets must NOT be in the response
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).toBe("An unexpected internal server error occurred.");
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("formatErrorResponse supports destructured { body, status } usage", () => {
    const error = new NotFoundError("Project", "prj_99");
    const { body, status } = formatErrorResponse(error);

    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Project 'prj_99' not found.");
  });
});
