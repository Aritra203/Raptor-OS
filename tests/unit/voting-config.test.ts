import { describe, it, expect } from "vitest";
import { updateVotingConfigSchema } from "@/lib/validations/community";

describe("Voting Configuration Validation (Phase 8)", () => {
  it("validates a complete and valid voting configuration", () => {
    const validConfig = {
      isEnabled: true,
      votingStart: new Date("2026-02-15T00:00:00Z").toISOString(),
      votingEnd: new Date("2026-02-20T00:00:00Z").toISOString(),
      eligibilityMode: "EVENT_PARTICIPANTS",
      allowParticipantVotes: true,
      allowJudgeVotes: true,
      allowOrganizerVotes: false,
      allowSelfVoting: false,
      publicVoteCounts: true,
      resultsPublished: false,
      randomizeGalleryOrder: true,
      galleryRandomSeed: 42,
    };

    const result = updateVotingConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("validates partial voting configuration updates", () => {
    const partialUpdate = {
      isEnabled: false,
      publicVoteCounts: false,
    };

    const result = updateVotingConfigSchema.safeParse(partialUpdate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isEnabled).toBe(false);
      expect(result.data.publicVoteCounts).toBe(false);
    }
  });

  it("rejects invalid eligibility mode", () => {
    const invalid = {
      eligibilityMode: "ANYONE_ON_THE_INTERNET",
    };

    const result = updateVotingConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid date formats", () => {
    const invalid = {
      votingStart: "not-a-date",
    };

    const result = updateVotingConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("permits nullifying start and end dates to make window unrestricted", () => {
    const unrestricted = {
      votingStart: null,
      votingEnd: null,
    };

    const result = updateVotingConfigSchema.safeParse(unrestricted);
    expect(result.success).toBe(true);
  });

  it("validates gallery random seed as integer", () => {
    const validSeed = { galleryRandomSeed: 12345 };
    const invalidSeed = { galleryRandomSeed: "random" };

    expect(updateVotingConfigSchema.safeParse(validSeed).success).toBe(true);
    expect(updateVotingConfigSchema.safeParse(invalidSeed).success).toBe(false);
  });
});
