import { describe, it, expect } from "vitest";
import { validateServerEnv, validateClientEnv } from "@/lib/env/env";

describe("Environment Validation", () => {
  const validServerEnv = {
    NODE_ENV: "development",
    PORT: "3000",
    DATABASE_URL: "postgresql://raptor:raptor_pass@localhost:5432/raptoros",
  };

  it("successfully validates a valid server environment", () => {
    const validated = validateServerEnv(validServerEnv);
    expect(validated.NODE_ENV).toBe("development");
    expect(validated.PORT).toBe(3000);
    expect(validated.DATABASE_URL).toBe("postgresql://raptor:raptor_pass@localhost:5432/raptoros");
  });

  it("fails when DATABASE_URL is missing", () => {
    const invalidEnv = { ...validServerEnv, DATABASE_URL: undefined };
    expect(() => validateServerEnv(invalidEnv)).toThrowError(
      /DATABASE_URL environment variable is required/
    );
  });

  it("fails when DATABASE_URL is not a valid URL", () => {
    const invalidEnv = { ...validServerEnv, DATABASE_URL: "not-a-valid-url" };
    expect(() => validateServerEnv(invalidEnv)).toThrowError(/DATABASE_URL must be a valid URL/);
  });

  it("fails when DATABASE_URL does not use postgresql:// protocol", () => {
    const invalidEnv = { ...validServerEnv, DATABASE_URL: "mysql://user:pass@localhost:3306/db" };
    expect(() => validateServerEnv(invalidEnv)).toThrowError(
      /DATABASE_URL must be a PostgreSQL connection string/
    );
  });

  it("coerces numeric string PORT to number", () => {
    const validated = validateServerEnv({ ...validServerEnv, PORT: "8080" });
    expect(validated.PORT).toBe(8080);
  });

  it("successfully validates client environment with defaults", () => {
    const client = validateClientEnv({});
    expect(client.NEXT_PUBLIC_APP_NAME).toBe("RaptorOS");
    expect(client.NEXT_PUBLIC_APP_VERSION).toBe("0.1.0");
  });
});
