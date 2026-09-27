import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("Password Hashing & Verification Unit Tests (Scrypt)", () => {
  it("generates valid serialized scrypt hash with random salt", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash.startsWith("$scrypt$")).toBe(true);

    const parts = hash.split("$");
    expect(parts).toHaveLength(5);
    expect(parts[1]).toBe("scrypt");
    expect(parts[2]).toContain("N=16384");
    expect(parts[3]).toBeDefined(); // salt hex
    expect(parts[4]).toBeDefined(); // hash hex
  });

  it("generates different hashes for identical passwords due to unique salts", async () => {
    const password = "IdenticalPassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toEqual(hash2);
  });

  it("verifies matching password returns true", async () => {
    const password = "CorrectHorseBatteryStaple!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("verifies wrong password returns false", async () => {
    const password = "CorrectPassword123!";
    const wrongPassword = "WrongPassword456!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("safely handles empty or malformed hash strings without throwing", async () => {
    expect(await verifyPassword("password", "")).toBe(false);
    expect(await verifyPassword("password", "invalid-hash")).toBe(false);
    expect(await verifyPassword("password", "$scrypt$incomplete")).toBe(false);
    expect(await verifyPassword("password", "$bcrypt$2a$12$somehash")).toBe(false);
  });

  it("throws error when hashing empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});
