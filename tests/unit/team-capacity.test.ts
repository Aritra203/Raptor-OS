import { describe, it, expect } from "vitest";
import { hashInvitationToken, generateInvitationToken } from "@/server/services/team.service";

describe("Team Security & Capacity Unit Tests (Phase 4)", () => {
  it("generates a 32-byte (64 hex characters) cryptographic invitation token", () => {
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();

    expect(typeof token1).toBe("string");
    expect(token1.length).toBe(64);
    expect(token2.length).toBe(64);
    expect(token1).not.toBe(token2);
  });

  it("produces deterministic SHA-256 hash for invitation tokens", () => {
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash1 = hashInvitationToken(rawToken);
    const hash2 = hashInvitationToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
    expect(hash1).not.toBe(rawToken); // Hash is distinct from raw token
  });

  it("hashes different tokens to completely different digests", () => {
    const tokenA = generateInvitationToken();
    const tokenB = generateInvitationToken();

    expect(hashInvitationToken(tokenA)).not.toBe(hashInvitationToken(tokenB));
  });
});
