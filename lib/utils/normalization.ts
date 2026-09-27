import { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/errors/app-error";

export type NormalizationMethod = "Z_SCORE" | "MIN_MAX";

export interface JudgeCalibrationStats {
  judgeId: string;
  judgeName?: string;
  count: number;
  mean: Prisma.Decimal;
  median: Prisma.Decimal;
  stdDev: Prisma.Decimal;
  min: Prisma.Decimal;
  max: Prisma.Decimal;
  range: Prisma.Decimal;
  severityIndicator: "LENIENT" | "STRICT" | "BALANCED";
  spreadIndicator: "WIDE_SPREAD" | "NARROW_SPREAD" | "NORMAL_SPREAD";
}

export interface ScoreItemForNormalization {
  judgeId: string;
  submissionId: string;
  assignmentId?: string;
  scoreId?: string;
  rawScore: Prisma.Decimal | number | string;
}

export interface NormalizedScoreResult {
  judgeId: string;
  submissionId: string;
  assignmentId?: string;
  scoreId?: string;
  rawScore: Prisma.Decimal;
  normalizedValue: Prisma.Decimal;
  zScore?: number;
  percentile?: number;
  calibrationData: {
    judgeMean: string;
    judgeStdDev: string;
    judgeMin: string;
    judgeMax: string;
    isOutlier: boolean;
  };
}

/**
 * Calculates arithmetic mean using Decimal precision.
 */
export function calculateMean(values: (Prisma.Decimal | number | string)[]): Prisma.Decimal {
  if (!values || values.length === 0) {
    return new Prisma.Decimal(0);
  }
  let sum = new Prisma.Decimal(0);
  for (const v of values) {
    sum = sum.add(new Prisma.Decimal(v));
  }
  return sum.dividedBy(values.length).toDecimalPlaces(6);
}

/**
 * Calculates Population Standard Deviation:
 * sigma = sqrt( (1 / N) * sum( (x_i - mean)^2 ) )
 *
 * NOTE: Population standard deviation is the canonical convention across RaptorOS.
 * If N < 2, or if all values are identical, returns Decimal(0).
 */
export function calculatePopulationStdDev(
  values: (Prisma.Decimal | number | string)[],
  meanInput?: Prisma.Decimal
): Prisma.Decimal {
  if (!values || values.length <= 1) {
    return new Prisma.Decimal(0);
  }

  const mean = meanInput ?? calculateMean(values);
  let squaredDiffSum = new Prisma.Decimal(0);

  for (const v of values) {
    const diff = new Prisma.Decimal(v).minus(mean);
    squaredDiffSum = squaredDiffSum.add(diff.times(diff));
  }

  const variance = squaredDiffSum.dividedBy(values.length);
  if (variance.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }

  return variance.sqrt().toDecimalPlaces(6);
}

/**
 * Calculates Sample Standard Deviation (N - 1 denominator).
 * Documented alongside population standard deviation for reference.
 */
export function calculateSampleStdDev(
  values: (Prisma.Decimal | number | string)[],
  meanInput?: Prisma.Decimal
): Prisma.Decimal {
  if (!values || values.length <= 1) {
    return new Prisma.Decimal(0);
  }

  const mean = meanInput ?? calculateMean(values);
  let squaredDiffSum = new Prisma.Decimal(0);

  for (const v of values) {
    const diff = new Prisma.Decimal(v).minus(mean);
    squaredDiffSum = squaredDiffSum.add(diff.times(diff));
  }

  const variance = squaredDiffSum.dividedBy(values.length - 1);
  if (variance.lessThanOrEqualTo(0)) {
    return new Prisma.Decimal(0);
  }

  return variance.sqrt().toDecimalPlaces(6);
}

/**
 * Calculates median of an array of numbers or Decimals deterministically.
 */
export function calculateMedian(values: (Prisma.Decimal | number | string)[]): Prisma.Decimal {
  if (!values || values.length === 0) {
    return new Prisma.Decimal(0);
  }

  const sorted = values
    .map((v) => new Prisma.Decimal(v))
    .sort((a, b) => (a.lessThan(b) ? -1 : a.greaterThan(b) ? 1 : 0));

  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid]!.toDecimalPlaces(4);
  }

  return sorted[mid - 1]!.add(sorted[mid]!).dividedBy(2).toDecimalPlaces(4);
}

/**
 * Calculates min, max, and range.
 */
export function calculateMinMaxRange(values: (Prisma.Decimal | number | string)[]): {
  min: Prisma.Decimal;
  max: Prisma.Decimal;
  range: Prisma.Decimal;
} {
  if (!values || values.length === 0) {
    return {
      min: new Prisma.Decimal(0),
      max: new Prisma.Decimal(0),
      range: new Prisma.Decimal(0),
    };
  }

  let min = new Prisma.Decimal(values[0]!);
  let max = new Prisma.Decimal(values[0]!);

  for (const v of values) {
    const dec = new Prisma.Decimal(v);
    if (dec.lessThan(min)) min = dec;
    if (dec.greaterThan(max)) max = dec;
  }

  return {
    min: min.toDecimalPlaces(4),
    max: max.toDecimalPlaces(4),
    range: max.minus(min).toDecimalPlaces(4),
  };
}

/**
 * Calculates z-score: z = (score - mean) / stdDev.
 * Safe zero-variance handling: if stdDev == 0, returns Decimal(0).
 */
export function calculateZScore(
  score: Prisma.Decimal | number | string,
  mean: Prisma.Decimal | number | string,
  stdDev: Prisma.Decimal | number | string
): Prisma.Decimal {
  const decScore = new Prisma.Decimal(score);
  const decMean = new Prisma.Decimal(mean);
  const decStdDev = new Prisma.Decimal(stdDev);

  if (decStdDev.isZero()) {
    return new Prisma.Decimal(0);
  }

  return decScore.minus(decMean).dividedBy(decStdDev).toDecimalPlaces(6);
}

/**
 * Transforms z-score into a standardized [0, 100] score suitable for ranking.
 *
 * Formula:
 *   Scaled = Base + ScaleFactor * zScore
 *   Default: Base = 50, ScaleFactor = 15
 *
 * Examples:
 *   z =  0.0  -> 50.00
 *   z = +1.0  -> 65.00
 *   z = -1.0  -> 35.00
 *   z = +2.0  -> 80.00
 *   z = -2.0  -> 20.00
 *
 * Clamped strictly between [0.00, 100.00].
 */
export function transformZScoreToScaled(
  zScore: Prisma.Decimal | number | string,
  base: number = 50,
  scaleFactor: number = 15
): Prisma.Decimal {
  const z = new Prisma.Decimal(zScore);
  const rawScaled = new Prisma.Decimal(base).add(z.times(scaleFactor));

  // Clamp to [0, 100]
  if (rawScaled.lessThan(0)) return new Prisma.Decimal(0);
  if (rawScaled.greaterThan(100)) return new Prisma.Decimal(100);

  return rawScaled.toDecimalPlaces(4);
}

/**
 * Min-Max normalization formula:
 *   normalized = ((score - min) / (max - min)) * 100
 *
 * Safe zero-variance handling:
 *   If max == min, fallback to 50.00 (or the score itself clamped to [0, 100]).
 */
export function calculateMinMaxNormalized(
  score: Prisma.Decimal | number | string,
  min: Prisma.Decimal | number | string,
  max: Prisma.Decimal | number | string
): Prisma.Decimal {
  const decScore = new Prisma.Decimal(score);
  const decMin = new Prisma.Decimal(min);
  const decMax = new Prisma.Decimal(max);
  const spread = decMax.minus(decMin);

  if (spread.isZero()) {
    // Deterministic fallback: identical scores map to 50.00
    return new Prisma.Decimal("50.0000");
  }

  const ratio = decScore.minus(decMin).dividedBy(spread);
  const scaled = ratio.times(100);

  // Clamp to [0, 100]
  if (scaled.lessThan(0)) return new Prisma.Decimal(0);
  if (scaled.greaterThan(100)) return new Prisma.Decimal(100);

  return scaled.toDecimalPlaces(4);
}

/**
 * Outlier detection rule:
 * Returns true if absolute z-score >= threshold (default 2.0).
 */
export function detectOutlier(
  zScore: Prisma.Decimal | number | string,
  threshold: number = 2.0
): boolean {
  const absZ = new Prisma.Decimal(zScore).abs();
  return absZ.greaterThanOrEqualTo(threshold);
}

/**
 * Normalizes scores for a population of judge evaluations.
 * Grouped deterministically by judgeId.
 */
export function normalizeJudgeScores(
  items: ScoreItemForNormalization[],
  method: NormalizationMethod,
  outlierThreshold: number = 2.0
): {
  normalizedScores: NormalizedScoreResult[];
  judgeStats: JudgeCalibrationStats[];
  overallMean: Prisma.Decimal;
  overallStdDev: Prisma.Decimal;
} {
  if (!items || items.length === 0) {
    return {
      normalizedScores: [],
      judgeStats: [],
      overallMean: new Prisma.Decimal(0),
      overallStdDev: new Prisma.Decimal(0),
    };
  }

  // 1. Group items by judge deterministically
  const itemsByJudge = new Map<string, ScoreItemForNormalization[]>();
  for (const item of items) {
    const list = itemsByJudge.get(item.judgeId) || [];
    list.push(item);
    itemsByJudge.set(item.judgeId, list);
  }

  // 2. Compute overall event-wide statistics for calibration baselines
  const allRawScores = items.map((it) => it.rawScore);
  const overallMean = calculateMean(allRawScores);
  const overallStdDev = calculatePopulationStdDev(allRawScores, overallMean);

  const judgeStats: JudgeCalibrationStats[] = [];
  const normalizedScores: NormalizedScoreResult[] = [];

  // Sort judges deterministically by judgeId
  const sortedJudgeIds = Array.from(itemsByJudge.keys()).sort();

  for (const judgeId of sortedJudgeIds) {
    const judgeItems = itemsByJudge.get(judgeId)!;
    const rawScores = judgeItems.map((it) => it.rawScore);

    const mean = calculateMean(rawScores);
    const stdDev = calculatePopulationStdDev(rawScores, mean);
    const median = calculateMedian(rawScores);
    const { min, max, range } = calculateMinMaxRange(rawScores);

    // Determine calibration indicators
    let severityIndicator: "LENIENT" | "STRICT" | "BALANCED" = "BALANCED";
    if (overallStdDev.greaterThan(0)) {
      const diffFromOverall = mean.minus(overallMean);
      if (diffFromOverall.greaterThan(overallStdDev.times(0.5))) {
        severityIndicator = "LENIENT";
      } else if (diffFromOverall.lessThan(overallStdDev.times(-0.5))) {
        severityIndicator = "STRICT";
      }
    }

    let spreadIndicator: "WIDE_SPREAD" | "NARROW_SPREAD" | "NORMAL_SPREAD" = "NORMAL_SPREAD";
    if (overallStdDev.greaterThan(0)) {
      if (stdDev.greaterThan(overallStdDev.times(1.2))) {
        spreadIndicator = "WIDE_SPREAD";
      } else if (stdDev.lessThan(overallStdDev.times(0.8))) {
        spreadIndicator = "NARROW_SPREAD";
      }
    }

    judgeStats.push({
      judgeId,
      count: judgeItems.length,
      mean,
      median,
      stdDev,
      min,
      max,
      range,
      severityIndicator,
      spreadIndicator,
    });

    // 3. Normalize individual scores
    for (const item of judgeItems) {
      const decRaw = new Prisma.Decimal(item.rawScore);
      let normalizedValue: Prisma.Decimal;
      let zScoreNum: number | undefined = undefined;

      const zScoreDec = calculateZScore(decRaw, mean, stdDev);
      zScoreNum = zScoreDec.toNumber();

      if (method === "Z_SCORE") {
        normalizedValue = transformZScoreToScaled(zScoreDec);
      } else if (method === "MIN_MAX") {
        normalizedValue = calculateMinMaxNormalized(decRaw, min, max);
      } else {
        throw new ValidationError(`Unsupported normalization method: '${method}'. Must be 'Z_SCORE' or 'MIN_MAX'.`);
      }

      const isOutlier = detectOutlier(zScoreDec, outlierThreshold);

      normalizedScores.push({
        judgeId: item.judgeId,
        submissionId: item.submissionId,
        assignmentId: item.assignmentId,
        scoreId: item.scoreId,
        rawScore: decRaw,
        normalizedValue,
        zScore: zScoreNum,
        calibrationData: {
          judgeMean: mean.toFixed(4),
          judgeStdDev: stdDev.toFixed(4),
          judgeMin: min.toFixed(4),
          judgeMax: max.toFixed(4),
          isOutlier,
        },
      });
    }
  }

  return {
    normalizedScores,
    judgeStats,
    overallMean,
    overallStdDev,
  };
}
