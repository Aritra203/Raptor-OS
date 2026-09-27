import { prisma } from "@/lib/db/prisma";
import { Prisma, type ResultStatus } from "@prisma/client";

export interface CreateProjectResultData {
  submissionId: string;
  trackId?: string | null;
  prizeId?: string | null;
  rank: number;
  trackRank?: number | null;
  rawAggregateScore: Prisma.Decimal;
  normalizedScore?: Prisma.Decimal | null;
  finalScore: Prisma.Decimal;
  scoreCount: number;
  metadata?: Record<string, unknown>;
}

export interface CreateSnapshotData {
  eventId: string;
  normalizationRunId?: string | null;
  name?: string;
  notes?: string;
  createdById: string;
  results: CreateProjectResultData[];
}

export class ResultsRepository {
  /**
   * Finds the next version number for an event result snapshot.
   */
  async getNextSnapshotVersion(eventId: string): Promise<number> {
    const latest = await prisma.resultSnapshot.findFirst({
      where: { eventId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  /**
   * Creates a ResultSnapshot and all ProjectResult rows atomically.
   */
  async createSnapshot(data: CreateSnapshotData) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const version = await this.getNextSnapshotVersion(data.eventId);

      const snapshot = await tx.resultSnapshot.create({
        data: {
          eventId: data.eventId,
          normalizationRunId: data.normalizationRunId || null,
          version,
          status: "DRAFT",
          name: data.name || `Result Snapshot v${version}`,
          notes: data.notes || null,
          createdById: data.createdById,
        },
      });

      if (data.results.length > 0) {
        await tx.projectResult.createMany({
          data: data.results.map((r) => ({
            snapshotId: snapshot.id,
            submissionId: r.submissionId,
            trackId: r.trackId || null,
            prizeId: r.prizeId || null,
            rank: r.rank,
            trackRank: r.trackRank ?? null,
            rawAggregateScore: r.rawAggregateScore,
            normalizedScore: r.normalizedScore ?? null,
            finalScore: r.finalScore,
            scoreCount: r.scoreCount,
            metadata: (r.metadata || {}) as Prisma.InputJsonValue,
          })),
        });
      }

      return snapshot;
    });
  }

  /**
   * Finds all result snapshots for an event.
   */
  async findSnapshotsByEvent(eventId: string) {
    return prisma.resultSnapshot.findMany({
      where: { eventId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        normalizationRun: { select: { id: true, method: true, version: true } },
        _count: { select: { results: true } },
      },
      orderBy: { version: "desc" },
    });
  }

  /**
   * Finds a snapshot by ID with full item details.
   */
  async findSnapshotById(snapshotId: string) {
    return prisma.resultSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        event: { select: { id: true, name: true, slug: true, state: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        normalizationRun: {
          select: {
            id: true,
            method: true,
            version: true,
            parameters: true,
            metadata: true,
          },
        },
        results: {
          include: {
            submission: {
              select: {
                id: true,
                title: true,
                description: true,
                repositoryUrl: true,
                demoUrl: true,
                team: { select: { id: true, name: true, slug: true } },
              },
            },
            track: { select: { id: true, name: true, slug: true } },
            prize: { select: { id: true, name: true, value: true } },
          },
          orderBy: { rank: "asc" },
        },
      },
    });
  }

  /**
   * Finds the active PUBLISHED snapshot for an event.
   */
  async findPublishedSnapshot(eventId: string) {
    return prisma.resultSnapshot.findFirst({
      where: {
        eventId,
        status: "PUBLISHED",
      },
      orderBy: { version: "desc" },
      include: {
        event: { select: { id: true, name: true, slug: true, state: true } },
        results: {
          include: {
            submission: {
              select: {
                id: true,
                title: true,
                description: true,
                repositoryUrl: true,
                demoUrl: true,
                deploymentUrl: true,
                documentationUrl: true,
                team: { select: { id: true, name: true, slug: true } },
              },
            },
            track: { select: { id: true, name: true, slug: true } },
            prize: { select: { id: true, name: true, value: true } },
          },
          orderBy: { rank: "asc" },
        },
      },
    });
  }

  /**
   * Updates snapshot status (e.g., to FINALIZED or PUBLISHED).
   */
  async updateSnapshotStatus(
    snapshotId: string,
    status: ResultStatus,
    timestampField?: "finalizedAt" | "publishedAt"
  ) {
    const data: Prisma.ResultSnapshotUpdateInput = { status };
    if (timestampField === "finalizedAt") data.finalizedAt = new Date();
    if (timestampField === "publishedAt") data.publishedAt = new Date();

    return prisma.resultSnapshot.update({
      where: { id: snapshotId },
      data,
    });
  }

  /**
   * Mirrors published snapshot results to legacy Result table for backward compatibility.
   */
  async mirrorToLegacyResults(snapshotId: string, eventId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const snapshot = await tx.resultSnapshot.findUnique({
        where: { id: snapshotId },
        include: { results: true },
      });

      if (!snapshot) return;

      for (const res of snapshot.results) {
        await tx.result.upsert({
          where: {
            eventId_submissionId: {
              eventId,
              submissionId: res.submissionId,
            },
          },
          create: {
            eventId,
            submissionId: res.submissionId,
            trackId: res.trackId,
            prizeId: res.prizeId,
            rank: res.rank,
            rawAggregateScore: res.rawAggregateScore,
            normalizedScore: res.normalizedScore,
            finalScore: res.finalScore,
            isPublished: true,
            publishedAt: new Date(),
          },
          update: {
            trackId: res.trackId,
            prizeId: res.prizeId,
            rank: res.rank,
            rawAggregateScore: res.rawAggregateScore,
            normalizedScore: res.normalizedScore,
            finalScore: res.finalScore,
            isPublished: true,
            publishedAt: new Date(),
          },
        });
      }
    });
  }
}

export const resultsRepository = new ResultsRepository();
