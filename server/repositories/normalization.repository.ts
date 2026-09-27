import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { NormalizationMethod, NormalizedScoreResult } from "@/lib/utils/normalization";

export interface CreateRunData {
  eventId: string;
  method: NormalizationMethod;
  parameters: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  executedById: string;
  inputScoreCount: number;
}

export interface FinalizedScoreWithRubric {
  id: string;
  eventId: string;
  judgeId: string;
  submissionId: string;
  judge: { id: string; name: string; email: string };
  submission: {
    id: string;
    title: string;
    state: string;
    trackId: string | null;
    team: { id: string; name: string };
  };
  rubricVersion: {
    id: string;
    criteria: { id: string; name: string; weight: Prisma.Decimal; maxScore: Prisma.Decimal }[];
  };
  items: { criterionId: string; rawScore: Prisma.Decimal }[];
}

export class NormalizationRepository {
  /**
   * Retrieves all finalized scores for an event.
   */
  async findFinalizedScoresForEvent(
    eventId: string,
    trackId?: string
  ): Promise<FinalizedScoreWithRubric[]> {
    return prisma.score.findMany({
      where: {
        eventId,
        isFinal: true,
        submission: {
          state: { in: ["SUBMITTED", "LOCKED"] },
          ...(trackId ? { trackId } : {}),
        },
      },
      include: {
        judge: { select: { id: true, name: true, email: true } },
        submission: {
          select: {
            id: true,
            title: true,
            state: true,
            trackId: true,
            team: { select: { id: true, name: true } },
          },
        },
        rubricVersion: {
          include: {
            criteria: {
              select: { id: true, name: true, weight: true, maxScore: true },
            },
          },
        },
        items: {
          select: { criterionId: true, rawScore: true },
        },
      },
      orderBy: [{ judgeId: "asc" }, { submissionId: "asc" }],
    }) as unknown as Promise<FinalizedScoreWithRubric[]>;
  }

  /**
   * Finds the next version number for a normalization run in an event.
   */
  async getNextRunVersion(eventId: string): Promise<number> {
    const latest = await prisma.normalizationRun.findFirst({
      where: { eventId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  /**
   * Creates a NormalizationRun record along with its NormalizedScores atomically.
   */
  async createRun(
    data: CreateRunData,
    normalizedScores: NormalizedScoreResult[]
  ) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const version = await this.getNextRunVersion(data.eventId);

      const run = await tx.normalizationRun.create({
        data: {
          eventId: data.eventId,
          method: data.method,
          version,
          parameters: data.parameters as Prisma.InputJsonValue,
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
          executedById: data.executedById,
          inputScoreCount: data.inputScoreCount,
          status: "COMPLETED",
        },
      });

      if (normalizedScores.length > 0) {
        await tx.normalizedScore.createMany({
          data: normalizedScores.map((s) => ({
            normalizationRunId: run.id,
            submissionId: s.submissionId,
            judgeId: s.judgeId,
            assignmentId: s.assignmentId || null,
            scoreId: s.scoreId || null,
            rawScore: s.rawScore,
            normalizedValue: s.normalizedValue,
            zScore: s.zScore ?? null,
            percentile: s.percentile ?? null,
            calibrationData: s.calibrationData as Prisma.InputJsonValue,
          })),
        });
      }

      return run;
    });
  }

  /**
   * Finds all normalization runs for an event.
   */
  async findRunsByEvent(eventId: string) {
    return prisma.normalizationRun.findMany({
      where: { eventId },
      include: {
        executedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { normalizedScores: true } },
      },
      orderBy: { version: "desc" },
    });
  }

  /**
   * Finds a specific normalization run by ID with normalized score details.
   */
  async findRunById(runId: string) {
    return prisma.normalizationRun.findUnique({
      where: { id: runId },
      include: {
        event: { select: { id: true, name: true, state: true } },
        executedBy: { select: { id: true, name: true, email: true } },
        normalizedScores: {
          include: {
            submission: { select: { id: true, title: true, trackId: true } },
            judge: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ submissionId: "asc" }, { judgeId: "asc" }],
        },
      },
    });
  }

  /**
   * Finds the latest completed normalization run for an event.
   */
  async findLatestRun(eventId: string) {
    return prisma.normalizationRun.findFirst({
      where: { eventId, status: "COMPLETED" },
      orderBy: { version: "desc" },
      include: {
        normalizedScores: true,
      },
    });
  }
}

export const normalizationRepository = new NormalizationRepository();
