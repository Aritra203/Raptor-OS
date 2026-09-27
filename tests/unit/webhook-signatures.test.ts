import { describe, it, expect } from "vitest";
import {
  computeHmacSha256,
  verifyHmacSha256,
} from "@/lib/crypto/signing";

describe("Phase 9 Webhook Signatures & Verification", () => {
  const secret = "whsec_test_secret_1234567890abcdef";
  const payload = {
    id: "evt_delivery_123",
    event: "submission.created",
    timestamp: "2026-02-15T12:00:00.000Z",
    data: {
      submissionId: "sub_1",
      title: "RaptorMesh",
      teamName: "Neural Core",
    },
  };

  it("computes reproducible HMAC-SHA256 hex signatures", () => {
    const signature1 = computeHmacSha256(payload, secret);
    const signature2 = computeHmacSha256(payload, secret);

    expect(signature1).toBe(signature2);
    expect(signature1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies matching signatures in constant time", () => {
    const signature = computeHmacSha256(payload, secret);
    const isValid = verifyHmacSha256(payload, signature, secret);

    expect(isValid).toBe(true);
  });

  it("rejects tampered payloads", () => {
    const signature = computeHmacSha256(payload, secret);
    const tamperedPayload = {
      ...payload,
      data: {
        ...payload.data,
        title: "Malicious Tampered Title",
      },
    };

    const isValid = verifyHmacSha256(tamperedPayload, signature, secret);
    expect(isValid).toBe(false);
  });

  it("rejects invalid or mismatched secrets", () => {
    const signature = computeHmacSha256(payload, secret);
    const wrongSecret = "whsec_wrong_secret_abcdef1234567890";

    const isValid = verifyHmacSha256(payload, signature, wrongSecret);
    expect(isValid).toBe(false);
  });

  it("gracefully rejects corrupted or non-hex signatures without crashing", () => {
    expect(verifyHmacSha256(payload, "not-a-valid-hex", secret)).toBe(false);
    expect(verifyHmacSha256(payload, "", secret)).toBe(false);
    expect(verifyHmacSha256(payload, "deadbeef", secret)).toBe(false);
  });
});
