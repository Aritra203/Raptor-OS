import { normalizationRepository } from "@/server/repositories/normalization.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { auditService } from "@/server/services/audit.service";
import { calculateWeightedScore } from "@/lib/utils/scoring";
import {
  normalizeJudgeScores,
  type ScoreItemForNormalization,
} from "@/lib/utils/normalization";
import {
  ValidationError,
  NotFoundError,
} from "@/lib/errors/app-error";
import type { CreateNormalizationRunInput } from "@/lib/validations/results";

export class NormalizationService {
  /**
   * Executes a deterministic normalization run for an event.
   *
   * Invariant guarantees:
   * 1. Raw scores (Score.rawScore and ScoreItem.rawScore) are NEVER altered.
   * 2. Runs are strictly versioned (v1, v2, ...).
   * 3. Grouped deterministically per judge to eliminate inter-judge grading variance.
   * 4. Safe zero-variance handling prevents division by zero without silently dropping projects.
   */
  async createRun(
    eventId: string,
    actorId: string,
    input: CreateNormalizationRunInput
  ) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    // 1. Fetch all finalized evaluations for the event
    const finalizedScores = await normalizationRepository.findFinalizedScoresForEvent(
      eventId,
      input.trackId
    );

    if (!finalizedScores || finalizedScores.length === 0) {
      throw new ValidationError(
        "No finalized judge evaluations found for this event. Cannot run normalization without finalized scores."
      );
    }

    // 2. Map finalized evaluations to weighted raw scores
    const itemsForNormalization: ScoreItemForNormalization[] = finalizedScores.map((sc) => {
      const criteriaMap = new Map(sc.rubricVersion.criteria.map((c) => [c.id, c]));
      const calculation = calculateWeightedScore(
        sc.items.map((it) => {
          const criterion = criteriaMap.get(it.criterionId);
          return {
            rawScore: it.rawScore,
            maxScore: criterion?.maxScore ?? 10,
            weight: criterion?.weight ?? 1,
          };
        })
      );

      return {
        judgeId: sc.judgeId,
        submissionId: sc.submissionId,
        scoreId: sc.id,
        rawScore: calculation.weightedScore,
      };
    });

    // 3. Execute mathematical normalization engine
    const { normalizedScores, judgeStats, overallMean, overallStdDev } = normalizeJudgeScores(
      itemsForNormalization,
      input.method,
      input.outlierThreshold
    );

    // 4. Persist run and normalized records atomically
    const run = await normalizationRepository.createRun(
      {
        eventId,
        method: input.method,
        parameters: {
          outlierThreshold: input.outlierThreshold,
          trackId: input.trackId || null,
          ...(input.parameters || {}),
        },
        metadata: {
          overallMean: overallMean.toFixed(4),
          overallStdDev: overallStdDev.toFixed(4),
          judgeStats: judgeStats.map((j) => ({
            ...j,
            mean: j.mean.toFixed(4),
            median: j.median.toFixed(4),
            stdDev: j.stdDev.toFixed(4),
            min: j.min.toFixed(4),
            max: j.max.toFixed(4),
            range: j.range.toFixed(4),
          })),
        },
        executedById: actorId,
        inputScoreCount: itemsForNormalization.length,
      },
      normalizedScores
    );

    // 5. Emit tamper-evident audit log
    await auditService.log({
      eventId,
      actorId,
      action: "NORMALIZATION_RUN_CREATED",
      entityType: "NormalizationRun",
      entityId: run.id,
      metadata: {
        runId: run.id,
        version: run.version,
        method: input.method,
        scoresCount: itemsForNormalization.length,
        judgesCount: judgeStats.length,
      },
    });

    return {
      run,
      judgeStats,
      overallMean,
      overallStdDev,
      normalizedScoreCount: normalizedScores.length,
    };
  }

  /**
   * Retrieves all normalization runs for an event.
   */
  async getRunsForEvent(eventId: string) {
    return normalizationRepository.findRunsByEvent(eventId);
  }

  /**
   * Retrieves details of a specific normalization run.
   */
  async getRunById(runId: string) {
    const run = await normalizationRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundError(`Normalization run with ID '${runId}' was not found.`);
    }
    return run;
  }

  /**
   * Retrieves judge calibration analytics across an event.
   */
  async getCalibrationAnalytics(eventId: string, trackId?: string) {
    const finalizedScores = await normalizationRepository.findFinalizedScoresForEvent(
      eventId,
      trackId
    );

    if (!finalizedScores || finalizedScores.length === 0) {
      return {
        totalEvaluations: 0,
        judgeStats: [],
        overallMean: "0.00",
        overallStdDev: "0.00",
      };
    }

    const itemsForNorm: ScoreItemForNormalization[] = finalizedScores.map((sc) => {
      const criteriaMap = new Map(sc.rubricVersion.criteria.map((c) => [c.id, c]));
      const calculation = calculateWeightedScore(
        sc.items.map((it) => {
          const criterion = criteriaMap.get(it.criterionId);
          return {
            rawScore: it.rawScore,
            maxScore: criterion?.maxScore ?? 10,
            weight: criterion?.weight ?? 1,
          };
        })
      );

      return {
        judgeId: sc.judgeId,
        submissionId: sc.submissionId,
        scoreId: sc.id,
        rawScore: calculation.weightedScore,
      };
    });

    const { judgeStats, overallMean, overallStdDev } = normalizeJudgeScores(
      itemsForNorm,
      "Z_SCORE"
    );

    // Attach judge names
    const judgeNameMap = new Map<string, string>();
    for (const sc of finalizedScores) {
      judgeNameMap.set(sc.judgeId, sc.judge.name || sc.judge.email);
    }

    return {
      totalEvaluations: itemsForNorm.length,
      overallMean: overallMean.toFixed(2),
      overallStdDev: overallStdDev.toFixed(2),
      judgeStats: judgeStats.map((j) => ({
        ...j,
        judgeName: judgeNameMap.get(j.judgeId) || j.judgeId,
        mean: j.mean.toFixed(2),
        median: j.median.toFixed(2),
        stdDev: j.stdDev.toFixed(2),
        min: j.min.toFixed(2),
        max: j.max.toFixed(2),
        range: j.range.toFixed(2),
      })),
    };
  }
}

export const normalizationService = new NormalizationService();
