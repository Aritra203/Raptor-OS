import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calculateMedian,
  detectOutlier,
  normalizeJudgeScores,
} from "@/lib/utils/normalization";

describe("Judge Calibration Analytics & Outlier Detection", () => {
  describe("Median Calculation (Odd vs Even counts)", () => {
    it("calculates median for odd number of values", () => {
      const odd = [
        new Prisma.Decimal(10),
        new Prisma.Decimal(50),
        new Prisma.Decimal(90),
      ];
      expect(calculateMedian(odd).toNumber()).toBe(50);
    });

    it("calculates median for even number of values (average of middle two)", () => {
      const even = [
        new Prisma.Decimal(20),
        new Prisma.Decimal(40),
        new Prisma.Decimal(60),
        new Prisma.Decimal(80),
      ];
      expect(calculateMedian(even).toNumber()).toBe(50);
    });

    it("calculates median for unsorted list correctly", () => {
      const unsorted = [
        new Prisma.Decimal(90),
        new Prisma.Decimal(10),
        new Prisma.Decimal(40),
      ];
      expect(calculateMedian(unsorted).toNumber()).toBe(40);
    });
  });

  describe("Outlier Detection (|z| >= threshold)", () => {
    it("flags scores with |z| >= 2.0 as outliers", () => {
      expect(detectOutlier(new Prisma.Decimal(2.0), 2.0)).toBe(true);
      expect(detectOutlier(new Prisma.Decimal(-2.5), 2.0)).toBe(true);
      expect(detectOutlier(new Prisma.Decimal(3.1), 2.0)).toBe(true);
    });

    it("does not flag scores within threshold", () => {
      expect(detectOutlier(new Prisma.Decimal(1.99), 2.0)).toBe(false);
      expect(detectOutlier(new Prisma.Decimal(-1.5), 2.0)).toBe(false);
      expect(detectOutlier(new Prisma.Decimal(0), 2.0)).toBe(false);
    });

    it("respects custom outlier thresholds", () => {
      expect(detectOutlier(new Prisma.Decimal(1.6), 1.5)).toBe(true);
      expect(detectOutlier(new Prisma.Decimal(1.4), 1.5)).toBe(false);
    });
  });

  describe("Calibration Analytics Generation", () => {
    it("generates comprehensive calibration statistics for each judge", () => {
      const items = [
        { judgeId: "judge_1", submissionId: "sub_1", rawScore: new Prisma.Decimal(60) },
        { judgeId: "judge_1", submissionId: "sub_2", rawScore: new Prisma.Decimal(70) },
        { judgeId: "judge_1", submissionId: "sub_3", rawScore: new Prisma.Decimal(80) },
        { judgeId: "judge_1", submissionId: "sub_4", rawScore: new Prisma.Decimal(90) },
      ];

      const { judgeStats } = normalizeJudgeScores(items, "Z_SCORE");

      expect(judgeStats).toHaveLength(1);
      const stat = judgeStats[0]!;

      expect(stat.judgeId).toBe("judge_1");
      expect(stat.count).toBe(4);
      expect(stat.mean.toNumber()).toBe(75);
      expect(stat.median.toNumber()).toBe(75);
      expect(stat.min.toNumber()).toBe(60);
      expect(stat.max.toNumber()).toBe(90);
      expect(stat.range.toNumber()).toBe(30);
    });
  });
});
