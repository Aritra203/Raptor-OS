import { describe, it, expect } from "vitest";
import { calculateWeightedScore, roundDecimal } from "@/lib/utils/scoring";
import { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/errors/app-error";

describe("Weighted Scoring Calculations", () => {
  it("calculates 100% when all criteria receive max scores", () => {
    const items = [
      { rawScore: 10, maxScore: 10, weight: 40 },
      { rawScore: 10, maxScore: 10, weight: 30 },
      { rawScore: 10, maxScore: 10, weight: 30 },
    ];

    const result = calculateWeightedScore(items);
    expect(result.weightedScore.toString()).toBe("100");
    expect(result.percentage.toString()).toBe("100");
  });

  it("calculates 0% when all criteria receive zero", () => {
    const items = [
      { rawScore: 0, maxScore: 10, weight: 40 },
      { rawScore: 0, maxScore: 10, weight: 30 },
      { rawScore: 0, maxScore: 10, weight: 30 },
    ];

    const result = calculateWeightedScore(items);
    expect(result.weightedScore.toString()).toBe("0");
    expect(result.percentage.toString()).toBe("0");
  });

  it("calculates exact fractional weighted scores without floating point drift", () => {
    // 5/10 * 40 = 20
    // 8/10 * 30 = 24
    // 9/10 * 30 = 27
    // Total = 20 + 24 + 27 = 71
    const items = [
      { rawScore: 5, maxScore: 10, weight: 40 },
      { rawScore: 8, maxScore: 10, weight: 30 },
      { rawScore: 9, maxScore: 10, weight: 30 },
    ];

    const result = calculateWeightedScore(items);
    expect(result.weightedScore.toString()).toBe("71");
    expect(result.percentage.toString()).toBe("71");
  });

  it("calculates normalized percentage with decimal weights (e.g. 0.4, 0.3, 0.3)", () => {
    // (10/10)*0.4 + (5/10)*0.3 + (10/10)*0.3 = 0.4 + 0.15 + 0.3 = 0.85
    // Percentage = (0.85 / 1.0) * 100 = 85%
    const items = [
      { rawScore: 10, maxScore: 10, weight: 0.4 },
      { rawScore: 5, maxScore: 10, weight: 0.3 },
      { rawScore: 10, maxScore: 10, weight: 0.3 },
    ];

    const result = calculateWeightedScore(items);
    expect(result.weightedScore.toString()).toBe("0.85");
    expect(result.percentage.toString()).toBe("85");
  });

  it("rejects rawScore exceeding maxScore", () => {
    const items = [{ rawScore: 12, maxScore: 10, weight: 100 }];
    expect(() => calculateWeightedScore(items)).toThrow(ValidationError);
  });

  it("rejects negative rawScore", () => {
    const items = [{ rawScore: -1, maxScore: 10, weight: 100 }];
    expect(() => calculateWeightedScore(items)).toThrow(ValidationError);
  });

  it("rounds decimal cleanly using roundDecimal helper", () => {
    const dec = new Prisma.Decimal("85.6666");
    const rounded = roundDecimal(dec, 2);
    expect(rounded.toString()).toBe("85.67");
  });
});
