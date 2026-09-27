import { describe, it, expect } from "vitest";
import {
  canonicalizeJson,
  computeSha256,
  signCanonicalData,
  verifyEd25519Signature,
  getPublicVerificationKey,
} from "@/lib/crypto/signing";

describe("Phase 9 Ed25519 Signed Records & Canonical Serialization", () => {
  it("canonicalizeJson sorts keys deterministically and eliminates key ordering variance", () => {
    const objA = {
      title: "RaptorMesh",
      score: 95.5,
      rubricId: "rub_1",
      criteria: [
        { name: "Innovation", score: 10 },
        { name: "Execution", score: 9 },
      ],
    };

    const objB = {
      criteria: [
        { score: 10, name: "Innovation" },
        { name: "Execution", score: 9 },
      ],
      rubricId: "rub_1",
      score: 95.5,
      title: "RaptorMesh",
    };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    expect(canonA).toBe(canonB);
    expect(computeSha256(objA)).toBe(computeSha256(objB));
  });

  it("produces valid Ed25519 signatures verifiable against server public key", async () => {
    const evaluationPayload = {
      eventId: "evt_offline_2026",
      submissionId: "sub_alpha",
      assignmentId: "asg_99",
      scores: [
        { criterionId: "crit_1", rawScore: "9.50" },
        { criterionId: "crit_2", rawScore: "8.75" },
      ],
      finalizedAt: "2026-02-15T18:00:00.000Z",
    };

    const signed = await signCanonicalData(evaluationPayload);

    expect(signed.algorithm).toBe("Ed25519");
    expect(signed.canonicalData).toBe(canonicalizeJson(evaluationPayload));
    expect(signed.recordHash).toBe(computeSha256(signed.canonicalData));
    expect(typeof signed.signature).toBe("string");
    expect(signed.signature.length).toBeGreaterThan(30);

    const publicKey = await getPublicVerificationKey();
    expect(publicKey).toContain("BEGIN PUBLIC KEY");

    const isValid = verifyEd25519Signature(
      signed.canonicalData,
      signed.signature,
      publicKey
    );
    expect(isValid).toBe(true);

    // Tampering test: modify any byte in canonical data
    const tamperedData = signed.canonicalData.replace("9.50", "10.00");
    const isTamperedValid = verifyEd25519Signature(
      tamperedData,
      signed.signature,
      publicKey
    );
    expect(isTamperedValid).toBe(false);
  });
});
