import { describe, it, expect } from "vitest";
import { resultsService } from "@/server/services/results.service";
import { NotFoundError } from "@/lib/errors/app-error";

describe("Results Access Control & Sanitization Integration", () => {
  it("returns sanitized public leaderboard for published event with zero judge leakage", async () => {
    const data = await resultsService.getPublicResults("evt_raptor_2026");

    expect(data.isPublished).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);

    const first = data.results[0]!;
    expect(first.rank).toBe(1);
    expect(first.finalScore).toBeDefined();
    expect(first.submission.title).toBeDefined();
    expect(first.submission.teamName).toBeDefined();

    // Verify ZERO judge identity or private calibration leakage
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("judge_id");
    expect(serialized).not.toContain("judgeId");
    expect(serialized).not.toContain("judgeEmail");
    expect(serialized).not.toContain("rawScore");
    expect(serialized).not.toContain("calibrationData");
    expect(serialized).not.toContain("zScore");
  });

  it("returns isPublished: false for an event without published results", async () => {
    const data = await resultsService.getPublicResults("evt_winter_code_2026");

    expect(data.isPublished).toBe(false);
    expect(data.results).toHaveLength(0);
  });

  it("throws NotFoundError when querying results for a non-existent event", async () => {
    await expect(
      resultsService.getPublicResults("evt_non_existent_404")
    ).rejects.toThrow(NotFoundError);
  });
});
