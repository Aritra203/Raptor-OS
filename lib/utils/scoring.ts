import { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/errors/app-error";

export interface CriterionWeightInput {
  weight: Prisma.Decimal | number | string;
}

export interface CriterionScoreCalculationInput {
  rawScore: Prisma.Decimal | number | string;
  maxScore: Prisma.Decimal | number | string;
  weight: Prisma.Decimal | number | string;
}

export interface WeightedScoreResult {
  /** The weighted aggregate score */
  weightedScore: Prisma.Decimal;
  /** Total weight of the criteria (should sum to 100 or 1) */
  totalWeight: Prisma.Decimal;
  /** Normalized percentage score between 0.00% and 100.00% */
  percentage: Prisma.Decimal;
}

/**
 * Validates that criteria weights sum to either 100.00% (percentage format) or 1.00 (decimal format).
 * Throws ValidationError if sum is invalid or any weight is non-positive.
 */
export function validateCriteriaWeights(
  criteria: CriterionWeightInput[]
): { valid: boolean; totalWeight: Prisma.Decimal } {
  if (!criteria || criteria.length === 0) {
    throw new ValidationError("A rubric must contain at least one criterion.");
  }

  let total = new Prisma.Decimal(0);

  for (const c of criteria) {
    const w = new Prisma.Decimal(c.weight);
    if (w.lessThanOrEqualTo(0)) {
      throw new ValidationError(`Criterion weight must be strictly greater than 0. Found: ${w.toString()}`);
    }
    total = total.add(w);
  }

  // Allow either 100% or 1.00 (with tolerance for floating point representations: 99.99 - 100.01 or 0.999 - 1.001)
  const is100 = total.greaterThanOrEqualTo(new Prisma.Decimal("99.99")) && total.lessThanOrEqualTo(new Prisma.Decimal("100.01"));
  const is1 = total.greaterThanOrEqualTo(new Prisma.Decimal("0.999")) && total.lessThanOrEqualTo(new Prisma.Decimal("1.001"));

  if (!is100 && !is1) {
    throw new ValidationError(
      `Criteria weights must sum to exactly 100% (or 1.00). Current total: ${total.toFixed(2)}`
    );
  }

  return { valid: true, totalWeight: total };
}

/**
 * Calculates weighted score using high-precision Decimal operations.
 * Prevents intermediate floating-point rounding errors.
 *
 * Formula:
 *   percentage = Sum( (rawScore_i / maxScore_i) * (weight_i / totalWeight) ) * 100
 *   weightedScore = Sum( (rawScore_i / maxScore_i) * weight_i )
 */
export function calculateWeightedScore(
  items: CriterionScoreCalculationInput[]
): WeightedScoreResult {
  if (!items || items.length === 0) {
    return {
      weightedScore: new Prisma.Decimal(0),
      totalWeight: new Prisma.Decimal(0),
      percentage: new Prisma.Decimal(0),
    };
  }

  let totalWeight = new Prisma.Decimal(0);
  let weightedSum = new Prisma.Decimal(0);

  for (const item of items) {
    const raw = new Prisma.Decimal(item.rawScore);
    const max = new Prisma.Decimal(item.maxScore);
    const weight = new Prisma.Decimal(item.weight);

    if (max.lessThanOrEqualTo(0)) {
      throw new ValidationError(`Criterion maxScore must be positive. Received: ${max.toString()}`);
    }
    if (raw.lessThan(0)) {
      throw new ValidationError(`Raw score cannot be negative. Received: ${raw.toString()}`);
    }
    if (raw.greaterThan(max)) {
      throw new ValidationError(
        `Raw score (${raw.toString()}) exceeds maximum allowed score (${max.toString()})`
      );
    }

    totalWeight = totalWeight.add(weight);
    // (raw / max) * weight
    const ratio = raw.dividedBy(max);
    weightedSum = weightedSum.add(ratio.times(weight));
  }

  const percentage = totalWeight.greaterThan(0)
    ? weightedSum.dividedBy(totalWeight).times(100).toDecimalPlaces(4)
    : new Prisma.Decimal(0);

  return {
    weightedScore: weightedSum.toDecimalPlaces(4),
    totalWeight: totalWeight.toDecimalPlaces(4),
    percentage,
  };
}

/**
 * Rounds a Prisma.Decimal to the specified decimal places.
 */
export function roundDecimal(val: Prisma.Decimal, places: number = 2): Prisma.Decimal {
  return val.toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP);
}
