import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateMean,
  calculatePopulationStdDev,
  calculateSampleStdDev,
  calculateMedian,
  calculateMinMaxRange,
  calculateZScore,
  transformZScoreToScaled,
  calculateMinMaxNormalized,
  normalizeJudgeScores,
} from "@/lib/utils/normalization";

describe("Score Normalization Engine - Mathematical Specifications", () => {
  describe("Reference Proof: Judge with scores [10, 20, 30]", () => {
    const scores = [new Prisma.Decimal(10), new Prisma.Decimal(20), new Prisma.Decimal(30)];

    it("calculates exact population mean", () => {
      const mean = calculateMean(scores);
      expect(mean.toNumber()).toBe(20);
    });

    it("calculates exact population standard deviation (sigma = sqrt(200/3))", () => {
      const mean = calculateMean(scores);
      const stdDev = calculatePopulationStdDev(scores, mean);
      // sqrt(200/3) = 8.16496580927726...
      expect(stdDev.toDecimalPlaces(4).toNumber()).toBe(8.165);
    });

    it("calculates sample standard deviation (s = sqrt(200/2) = 10)", () => {
      const mean = calculateMean(scores);
      const sampleStd = calculateSampleStdDev(scores, mean);
      expect(sampleStd.toNumber()).toBe(10);
    });

    it("calculates exact median and range", () => {
      const median = calculateMedian(scores);
      const { min, max, range } = calculateMinMaxRange(scores);

      expect(median.toNumber()).toBe(20);
      expect(min.toNumber()).toBe(10);
      expect(max.toNumber()).toBe(30);
      expect(range.toNumber()).toBe(20);
    });

    it("calculates exact Z-scores and scaled T-scores (50 + 15z)", () => {
      const mean = calculateMean(scores);
      const stdDev = calculatePopulationStdDev(scores, mean);

      const z10 = calculateZScore(scores[0]!, mean, stdDev);
      const z20 = calculateZScore(scores[1]!, mean, stdDev);
      const z30 = calculateZScore(scores[2]!, mean, stdDev);

      // z = -sqrt(1.5) approx -1.2247
      expect(z10.toDecimalPlaces(4).toNumber()).toBe(-1.2247);
      expect(z20.toNumber()).toBe(0);
      expect(z30.toDecimalPlaces(4).toNumber()).toBe(1.2247);

      // Scaled T-scores: 50 + 15*z
      const t10 = transformZScoreToScaled(z10);
      const t20 = transformZScoreToScaled(z20);
      const t30 = transformZScoreToScaled(z30);

      // 50 + 15 * (-1.22474487) = 31.6288... -> 31.6288
      expect(t10.toDecimalPlaces(2).toNumber()).toBe(31.63);
      expect(t20.toNumber()).toBe(50);
      expect(t30.toDecimalPlaces(2).toNumber()).toBe(68.37);
    });

    it("calculates Min-Max normalized scores (0 - 100)", () => {
      const { min, max } = calculateMinMaxRange(scores);

      const mm10 = calculateMinMaxNormalized(scores[0]!, min, max);
      const mm20 = calculateMinMaxNormalized(scores[1]!, min, max);
      const mm30 = calculateMinMaxNormalized(scores[2]!, min, max);

      expect(mm10.toNumber()).toBe(0);
      expect(mm20.toNumber()).toBe(50);
      expect(mm30.toNumber()).toBe(100);
    });
  });

  describe("Safe Zero-Variance Handling (Edge Cases)", () => {
    it("handles identical scores safely in Z-Score mode (fallback to 50.00)", () => {
      const identicalScores = [
        new Prisma.Decimal(25),
        new Prisma.Decimal(25),
        new Prisma.Decimal(25),
      ];

      const mean = calculateMean(identicalScores);
      const stdDev = calculatePopulationStdDev(identicalScores, mean);

      expect(stdDev.toNumber()).toBe(0);

      const z = calculateZScore(identicalScores[0]!, mean, stdDev);
      expect(z.toNumber()).toBe(0);

      const scaled = transformZScoreToScaled(z);
      expect(scaled.toNumber()).toBe(50);
    });

    it("handles identical scores safely in Min-Max mode (fallback to 50.00)", () => {
      const identicalScores = [
        new Prisma.Decimal(75),
        new Prisma.Decimal(75),
      ];

      const { min, max } = calculateMinMaxRange(identicalScores);
      expect(min.equals(max)).toBe(true);

      const mm = calculateMinMaxNormalized(identicalScores[0]!, min, max);
      expect(mm.toNumber()).toBe(50);
    });

    it("handles single-score evaluation safely (stdDev = 0, falls back to 50.00)", () => {
      const singleScore = [new Prisma.Decimal(88)];
      const mean = calculateMean(singleScore);
      const stdDev = calculatePopulationStdDev(singleScore, mean);

      expect(stdDev.toNumber()).toBe(0);
      const z = calculateZScore(singleScore[0]!, mean, stdDev);
      expect(transformZScoreToScaled(z).toNumber()).toBe(50);
    });
  });

  describe("T-Score Clamping Boundary Invariants", () => {
    it("clamps extreme low scores to 0", () => {
      const extremeZ = new Prisma.Decimal(-5.0); // 50 + 15*(-5) = -25 -> clamp to 0
      const scaled = transformZScoreToScaled(extremeZ);
      expect(scaled.toNumber()).toBe(0);
    });

    it("clamps extreme high scores to 100", () => {
      const extremeZ = new Prisma.Decimal(5.0); // 50 + 15*(5) = 125 -> clamp to 100
      const scaled = transformZScoreToScaled(extremeZ);
      expect(scaled.toNumber()).toBe(100);
    });
  });

  describe("Multi-Judge Normalization Pipeline", () => {
    it("normalizes scores grouped strictly by judge to eliminate inter-judge bias", () => {
      // Judge 1: Lenient judge giving [80, 90, 100]
      // Judge 2: Strict judge giving [20, 30, 40]
      const items = [
        { judgeId: "judge_lenient", submissionId: "sub_1", rawScore: new Prisma.Decimal(80) },
        { judgeId: "judge_lenient", submissionId: "sub_2", rawScore: new Prisma.Decimal(90) },
        { judgeId: "judge_lenient", submissionId: "sub_3", rawScore: new Prisma.Decimal(100) },
        { judgeId: "judge_strict", submissionId: "sub_1", rawScore: new Prisma.Decimal(20) },
        { judgeId: "judge_strict", submissionId: "sub_2", rawScore: new Prisma.Decimal(30) },
        { judgeId: "judge_strict", submissionId: "sub_3", rawScore: new Prisma.Decimal(40) },
      ];

      const result = normalizeJudgeScores(items, "MIN_MAX");

      expect(result.judgeStats).toHaveLength(2);

      // In Min-Max, both judge_lenient's sub_1 (80) and judge_strict's sub_1 (20) should map to 0
      const sub1Scores = result.normalizedScores.filter((s) => s.submissionId === "sub_1");
      expect(sub1Scores).toHaveLength(2);
      expect(sub1Scores[0]?.normalizedValue.toNumber()).toBe(0);
      expect(sub1Scores[1]?.normalizedValue.toNumber()).toBe(0);

      // Both judges' median project (sub_2: 90 and 30) should map to 50
      const sub2Scores = result.normalizedScores.filter((s) => s.submissionId === "sub_2");
      expect(sub2Scores[0]?.normalizedValue.toNumber()).toBe(50);
      expect(sub2Scores[1]?.normalizedValue.toNumber()).toBe(50);

      // Both judges' top project (sub_3: 100 and 40) should map to 100
      const sub3Scores = result.normalizedScores.filter((s) => s.submissionId === "sub_3");
      expect(sub3Scores[0]?.normalizedValue.toNumber()).toBe(100);
      expect(sub3Scores[1]?.normalizedValue.toNumber()).toBe(100);
    });
  });
});
