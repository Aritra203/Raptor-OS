import { z } from "zod";

export const normalizationMethodEnum = z.enum(["Z_SCORE", "MIN_MAX"]);

export const createNormalizationRunSchema = z.object({
  method: normalizationMethodEnum,
  outlierThreshold: z.number().min(0.5).max(5.0).default(2.0),
  parameters: z.record(z.unknown()).optional(),
  trackId: z.string().cuid().optional(),
});

export type CreateNormalizationRunInput = z.infer<typeof createNormalizationRunSchema>;

export const generateRankingsSchema = z.object({
  normalizationRunId: z.string().cuid().optional(),
  trackId: z.string().cuid().optional(),
  minEvaluationsRequired: z.number().int().min(1).default(1),
  tieBreakPolicy: z.enum(["STANDARD", "CONSENSUS_FIRST"]).default("STANDARD"),
});

export type GenerateRankingsInput = z.infer<typeof generateRankingsSchema>;

export const createResultSnapshotSchema = z.object({
  normalizationRunId: z.string().cuid().optional(),
  name: z.string().min(1).max(100).optional(),
  notes: z.string().max(2000).optional(),
  trackId: z.string().cuid().optional(),
  prizeAllocations: z
    .array(
      z.object({
        prizeId: z.string().cuid(),
        submissionId: z.string().cuid(),
      })
    )
    .optional(),
});

export type CreateResultSnapshotInput = z.infer<typeof createResultSnapshotSchema>;

export const publishResultsSchema = z.object({
  confirmPublish: z.literal(true, {
    errorMap: () => ({ message: "You must confirm publication to make results public." }),
  }),
  transitionEventState: z.boolean().default(true),
});

export type PublishResultsInput = z.infer<typeof publishResultsSchema>;
