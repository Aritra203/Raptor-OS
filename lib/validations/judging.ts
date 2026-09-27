import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitizer";

/**
 * Criterion input schema for rubric creation and versioning.
 */
export const criterionInputSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .min(2, "Criterion name must be at least 2 characters")
    .max(100, "Criterion name cannot exceed 100 characters")
    .transform(sanitizeText),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val) : null)),
  weight: z.union([z.number().positive("Weight must be positive"), z.string().min(1)]).transform((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error("Weight must be a positive number");
    return num;
  }),
  maxScore: z
    .union([z.number().positive("Max score must be positive"), z.string().min(1)])
    .default(10)
    .transform((val) => {
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) throw new Error("Max score must be a positive number");
      return num;
    }),
  order: z.number().int().default(0),
});

export type CriterionInput = z.infer<typeof criterionInputSchema>;

/**
 * Schema for creating a new rubric template in an event.
 */
export const createRubricSchema = z.object({
  name: z
    .string()
    .min(3, "Rubric name must be at least 3 characters")
    .max(100, "Rubric name cannot exceed 100 characters")
    .transform(sanitizeText),
  description: z
    .string()
    .max(1000, "Description cannot exceed 1,000 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val) : null)),
  trackId: z.string().optional().nullable(),
  criteria: z.array(criterionInputSchema).min(1, "At least one criterion is required"),
});

export type CreateRubricInput = z.infer<typeof createRubricSchema>;

/**
 * Schema for creating a new version of an existing rubric.
 */
export const createRubricVersionSchema = z.object({
  criteria: z.array(criterionInputSchema).min(1, "At least one criterion is required for a rubric version"),
});

export type CreateRubricVersionInput = z.infer<typeof createRubricVersionSchema>;

/**
 * Schema for batch assignment generation.
 */
export const generateAssignmentsSchema = z.object({
  targetJudgesPerSubmission: z
    .number()
    .int()
    .min(1, "Target judges per submission must be at least 1")
    .max(20, "Target judges per submission cannot exceed 20")
    .default(2),
  trackId: z.string().optional().nullable(),
});

export type GenerateAssignmentsInput = z.infer<typeof generateAssignmentsSchema>;

/**
 * Individual score item input within a score draft or submission.
 */
export const scoreItemInputSchema = z.object({
  criterionId: z.string().min(1, "Criterion ID is required"),
  rawScore: z
    .union([z.number().min(0, "Score cannot be negative"), z.string().min(1)])
    .transform((val) => {
      const num = typeof val === "string" ? parseFloat(val) : val;
      if (isNaN(num) || num < 0) throw new Error("Raw score must be non-negative");
      return num;
    }),
  feedback: z
    .string()
    .max(2000, "Feedback cannot exceed 2,000 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val) : null)),
});

export type ScoreItemInput = z.infer<typeof scoreItemInputSchema>;

/**
 * Schema for saving a score draft (partial criteria allowed).
 */
export const saveScoreDraftSchema = z.object({
  feedback: z
    .string()
    .max(5000, "Overall feedback cannot exceed 5,000 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val) : null)),
  items: z.array(scoreItemInputSchema).default([]),
});

export type SaveScoreDraftInput = z.infer<typeof saveScoreDraftSchema>;

/**
 * Schema for finalizing an official score (all criteria required).
 */
export const finalizeScoreSchema = z.object({
  feedback: z
    .string()
    .max(5000, "Overall feedback cannot exceed 5,000 characters")
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeText(val) : null)),
  items: z.array(scoreItemInputSchema).min(1, "At least one scored criterion is required to finalize"),
});

export type FinalizeScoreInput = z.infer<typeof finalizeScoreSchema>;
