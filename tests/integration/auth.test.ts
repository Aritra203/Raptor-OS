import { describe, it, expect, afterAll } from "vitest";
import { authService } from "@/server/services/auth.service";
import { hashSessionToken } from "@/server/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors/app-error";

describe("Authentication & Session Lifecycle Integration Tests (Phase 3)", () => {
  const testPrefix = `test-auth-${Date.now()}`;
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("registers a new user, hashes password, creates a session, and omits password hash from safe user", async () => {
    const email = `${testPrefix}-reg@raptoros.local`;
    const result = await authService.register({
      name: "Registration Test User",
      email,
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
      ipAddress: "127.0.0.1",
    });

    createdUserIds.push(result.user.id);

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe(email.toLowerCase());
    expect(result.user.name).toBe("Registration Test User");
    expect(result.sessionToken).toBeDefined();
    expect(result.sessionToken.length).toBe(64); // 32 bytes hex

    // CRITICAL SECURITY INVARIANT: SafeUser MUST NEVER return passwordHash!
    expect("passwordHash" in result.user).toBe(false);

    // Verify database record has hashed password, NOT plaintext
    const dbUser = await prisma.user.findUnique({ where: { id: result.user.id } });
    expect(dbUser?.passwordHash).toBeDefined();
    expect(dbUser?.passwordHash).not.toBe("StrongPassword123!");
    expect(dbUser?.passwordHash?.startsWith("$scrypt$")).toBe(true);

    // Verify session stored in DB has hashed token, NOT raw token
    const tokenHash = hashSessionToken(result.sessionToken);
    const dbSession = await prisma.session.findUnique({ where: { tokenHash } });
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(result.user.id);
    expect(dbSession?.tokenHash).toBe(tokenHash);
    expect(dbSession?.tokenHash).not.toBe(result.sessionToken);
  });

  it("rejects registration with duplicate email", async () => {
    const email = `${testPrefix}-dup@raptoros.local`;
    const reg1 = await authService.register({
      name: "User One",
      email,
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
    });
    createdUserIds.push(reg1.user.id);

    await expect(
      authService.register({
        name: "User Two",
        email: email.toUpperCase(), // Case normalization check
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      })
    ).rejects.toThrowError(ValidationError);
  });

  it("rejects registration when passwords do not match", async () => {
    await expect(
      authService.register({
        name: "Mismatch User",
        email: `${testPrefix}-mismatch@raptoros.local`,
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      })
    ).rejects.toThrowError(/Passwords do not match/);
  });

  it("rejects registration with password shorter than 8 characters", async () => {
    await expect(
      authService.register({
        name: "Short Pass User",
        email: `${testPrefix}-short@raptoros.local`,
        password: "short",
        confirmPassword: "short",
      })
    ).rejects.toThrowError(/at least 8 characters/);
  });

  it("successfully logs in with valid credentials and establishes session", async () => {
    const email = `${testPrefix}-login@raptoros.local`;
    const reg = await authService.register({
      name: "Login Success User",
      email,
      password: "ValidLoginPassword123!",
      confirmPassword: "ValidLoginPassword123!",
    });
    createdUserIds.push(reg.user.id);

    const loginResult = await authService.login({
      email,
      password: "ValidLoginPassword123!",
      ipAddress: "127.0.0.1",
      userAgent: "TestBrowser/1.0",
    });

    expect(loginResult.user.id).toBe(reg.user.id);
    expect(loginResult.sessionToken).toBeDefined();

    // Verify session validates
    const authContext = await authService.validateSession(loginResult.sessionToken);
    expect(authContext).not.toBeNull();
    expect(authContext?.user.id).toBe(reg.user.id);
  });

  it("rejects login with incorrect password with generic error message", async () => {
    const email = `${testPrefix}-wrongpass@raptoros.local`;
    const reg = await authService.register({
      name: "Wrong Pass User",
      email,
      password: "CorrectPassword123!",
      confirmPassword: "CorrectPassword123!",
    });
    createdUserIds.push(reg.user.id);

    await expect(
      authService.login({
        email,
        password: "IncorrectPassword!",
      })
    ).rejects.toThrowError("Invalid email or password.");
  });

  it("rejects login with unknown email with generic error message (preventing user enumeration)", async () => {
    await expect(
      authService.login({
        email: `nonexistent-${Date.now()}@raptoros.local`,
        password: "SomePassword123!",
      })
    ).rejects.toThrowError("Invalid email or password.");
  });

  it("revokes session on logout and rejects subsequent authentication attempts", async () => {
    const email = `${testPrefix}-logout@raptoros.local`;
    const reg = await authService.register({
      name: "Logout User",
      email,
      password: "LogoutPassword123!",
      confirmPassword: "LogoutPassword123!",
    });
    createdUserIds.push(reg.user.id);

    // 1. Session is valid before logout
    const validBefore = await authService.validateSession(reg.sessionToken);
    expect(validBefore).not.toBeNull();

    // 2. Perform logout
    await authService.logout(reg.sessionToken);

    // 3. Session is now invalid (revoked)
    const validAfter = await authService.validateSession(reg.sessionToken);
    expect(validAfter).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const email = `${testPrefix}-expired@raptoros.local`;
    const reg = await authService.register({
      name: "Expired Session User",
      email,
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    createdUserIds.push(reg.user.id);

    // Manually expire session in DB
    const tokenHash = hashSessionToken(reg.sessionToken);
    await prisma.session.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1000) }, // 1 second in the past
    });

    const validated = await authService.validateSession(reg.sessionToken);
    expect(validated).toBeNull();
  });

  it("audits authentication events without leaking secrets or credentials", async () => {
    const email = `${testPrefix}-audit@raptoros.local`;
    const reg = await authService.register({
      name: "Audit User",
      email,
      password: "SecretPassword123!",
      confirmPassword: "SecretPassword123!",
    });
    createdUserIds.push(reg.user.id);

    // Find audit log for registration
    const logs = await prisma.auditLog.findMany({
      where: { actorId: reg.user.id },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const regLog = logs.find((l) => l.action === "USER_REGISTERED");
    expect(regLog).toBeDefined();

    const serializedMetadata = JSON.stringify(regLog?.metadata || {});
    // Must NEVER contain passwords, password hashes, or session tokens
    expect(serializedMetadata).not.toContain("SecretPassword123!");
    expect(serializedMetadata).not.toContain("$scrypt$");
    expect(serializedMetadata).not.toContain(reg.sessionToken);
  });
});
