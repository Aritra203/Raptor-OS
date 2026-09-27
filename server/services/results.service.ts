import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { resultsRepository } from "@/server/repositories/results.repository";
import { normalizationRepository } from "@/server/repositories/normalization.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { auditService } from "@/server/services/audit.service";
import { calculateWeightedScore } from "@/lib/utils/scoring";
import { calculateMean, calculatePopulationStdDev } from "@/lib/utils/normalization";
import {
  ValidationError,
  NotFoundError,
} from "@/lib/errors/app-error";
import type {
  GenerateRankingsInput,
  CreateResultSnapshotInput,
  PublishResultsInput,
} from "@/lib/validations/results";

export interface RankedProjectItem {
  submissionId: string;
  title: string;
  teamId: string;
  teamName: string;
  trackId: string | null;
  trackName: string | null;
  prizeId: string | null;
  prizeName: string | null;
  rank: number;
  trackRank: number | null;
  rawAggregateScore: Prisma.Decimal;
  normalizedScore: Prisma.Decimal | null;
  finalScore: Prisma.Decimal;
  scoreCount: number;
  variance: Prisma.Decimal;
  isInsufficient: boolean;
  warnings: string[];
}

export class ResultsService {
  /**
   * Generates deterministic rankings from finalized judge scores and optional normalization.
   *
   * Tie-Breaking Hierarchy:
   * 1. finalScore (descending)
   * 2. rawAggregateScore (descending)
   * 3. variance (ascending — higher consensus among judges favored)
   * 4. submissionId (lexicographical ascending — stable unique deterministic tie-breaker)
   */
  async generateRankings(
    eventId: string,
    options: Partial<GenerateRankingsInput> = {}
  ): Promise<{
    items: RankedProjectItem[];
    normalizationRun: { id: string; method: string; version: number } | null;
    totalRanked: number;
    insufficientCount: number;
  }> {
    const minRequired = options.minEvaluationsRequired ?? 1;
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    // 1. Fetch eligible submissions (must be SUBMITTED or LOCKED, not DISQUALIFIED)
    const submissions = await prisma.submission.findMany({
      where: {
        eventId,
        state: { in: ["SUBMITTED", "LOCKED"] },
        ...(options.trackId ? { trackId: options.trackId } : {}),
      },
      include: {
        team: { select: { id: true, name: true } },
        track: { select: { id: true, name: true } },
      },
    });

    if (submissions.length === 0) {
      return {
        items: [],
        normalizationRun: null,
        totalRanked: 0,
        insufficientCount: 0,
      };
    }

    // 2. Fetch normalization run (if specified, or latest completed run)
    let normalizationRun = null;
    if (options.normalizationRunId) {
      normalizationRun = await normalizationRepository.findRunById(options.normalizationRunId);
    } else {
      normalizationRun = await normalizationRepository.findLatestRun(eventId);
    }

    // Index normalized scores by submissionId
    const normalizedBySubmission = new Map<string, Prisma.Decimal[]>();
    if (normalizationRun) {
      const normScores = await prisma.normalizedScore.findMany({
        where: { normalizationRunId: normalizationRun.id },
      });
      for (const ns of normScores) {
        const list = normalizedBySubmission.get(ns.submissionId) || [];
        list.push(ns.normalizedValue);
        normalizedBySubmission.set(ns.submissionId, list);
      }
    }

    // 3. Fetch all finalized raw scores for this event
    const finalizedScores = await normalizationRepository.findFinalizedScoresForEvent(
      eventId,
      options.trackId
    );

    // Group raw weighted scores by submissionId
    const rawScoresBySubmission = new Map<string, Prisma.Decimal[]>();
    for (const sc of finalizedScores) {
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

      const list = rawScoresBySubmission.get(sc.submissionId) || [];
      list.push(calculation.weightedScore);
      rawScoresBySubmission.set(sc.submissionId, list);
    }

    // 4. Fetch event tracks and prizes for allocation
    const prizes = await prisma.prize.findMany({
      where: { eventId },
      orderBy: [{ trackId: "asc" }, { order: "asc" }, { value: "desc" }],
    });

    // 5. Aggregate scores per submission
    const projectAggregates: Array<{
      submission: (typeof submissions)[0];
      rawAggregate: Prisma.Decimal;
      normalizedAggregate: Prisma.Decimal | null;
      finalScore: Prisma.Decimal;
      scoreCount: number;
      variance: Prisma.Decimal;
      isInsufficient: boolean;
      warnings: string[];
    }> = [];

    let insufficientCount = 0;

    for (const sub of submissions) {
      const rawScores = rawScoresBySubmission.get(sub.id) || [];
      const normScores = normalizedBySubmission.get(sub.id) || [];

      const rawAggregate = rawScores.length > 0 ? calculateMean(rawScores) : new Prisma.Decimal(0);
      const normalizedAggregate = normScores.length > 0 ? calculateMean(normScores) : null;
      const finalScore = normalizedAggregate ?? rawAggregate;

      const stdDev = rawScores.length > 1 ? calculatePopulationStdDev(rawScores, rawAggregate) : new Prisma.Decimal(0);
      const variance = stdDev.times(stdDev);

      const scoreCount = rawScores.length;
      const isInsufficient = scoreCount < minRequired;
      if (isInsufficient) insufficientCount++;

      const warnings: string[] = [];
      if (scoreCount === 0) {
        warnings.push("No finalized evaluations received.");
      } else if (isInsufficient) {
        warnings.push(`Received ${scoreCount} evaluation(s); minimum required is ${minRequired}.`);
      }

      projectAggregates.push({
        submission: sub,
        rawAggregate: rawAggregate.toDecimalPlaces(4),
        normalizedAggregate: normalizedAggregate ? normalizedAggregate.toDecimalPlaces(4) : null,
        finalScore: finalScore.toDecimalPlaces(4),
        scoreCount,
        variance: variance.toDecimalPlaces(4),
        isInsufficient,
        warnings,
      });
    }

    // 6. Deterministic multi-tier sort
    projectAggregates.sort((a, b) => {
      // 1. finalScore (desc)
      if (!a.finalScore.equals(b.finalScore)) {
        return b.finalScore.minus(a.finalScore).toNumber();
      }
      // 2. rawAggregate (desc)
      if (!a.rawAggregate.equals(b.rawAggregate)) {
        return b.rawAggregate.minus(a.rawAggregate).toNumber();
      }
      // 3. variance (asc — lower variance means higher consensus among judges)
      if (!a.variance.equals(b.variance)) {
        return a.variance.minus(b.variance).toNumber();
      }
      // 4. submissionId (stable tie-breaker asc)
      return a.submission.id.localeCompare(b.submission.id);
    });

    // 7. Assign overall ranks
    const rankedItems: RankedProjectItem[] = [];
    const trackCounters = new Map<string, number>();

    // Track prize assignments to avoid duplicates
    const assignedPrizeIds = new Set<string>();

    for (let i = 0; i < projectAggregates.length; i++) {
      const agg = projectAggregates[i]!;
      const rank = i + 1;

      // Track rank
      let trackRank: number | null = null;
      if (agg.submission.trackId) {
        const count = (trackCounters.get(agg.submission.trackId) || 0) + 1;
        trackCounters.set(agg.submission.trackId, count);
        trackRank = count;
      }

      // Check prize eligibility
      let prizeId: string | null = null;
      let prizeName: string | null = null;

      // Check overall prizes (rank matching)
      const overallPrizes = prizes.filter((p) => !p.trackId && !assignedPrizeIds.has(p.id));
      if (overallPrizes.length >= rank) {
        const p = overallPrizes[rank - 1]!;
        prizeId = p.id;
        prizeName = p.name;
        assignedPrizeIds.add(p.id);
      } else if (agg.submission.trackId && trackRank) {
        // Check track prize
        const trackPrize = prizes.find(
          (p) => p.trackId === agg.submission.trackId && !assignedPrizeIds.has(p.id)
        );
        if (trackPrize && trackRank === 1) {
          prizeId = trackPrize.id;
          prizeName = trackPrize.name;
          assignedPrizeIds.add(trackPrize.id);
        }
      }

      rankedItems.push({
        submissionId: agg.submission.id,
        title: agg.submission.title,
        teamId: agg.submission.team.id,
        teamName: agg.submission.team.name,
        trackId: agg.submission.trackId,
        trackName: agg.submission.track?.name || null,
        prizeId,
        prizeName,
        rank,
        trackRank,
        rawAggregateScore: agg.rawAggregate,
        normalizedScore: agg.normalizedAggregate,
        finalScore: agg.finalScore,
        scoreCount: agg.scoreCount,
        variance: agg.variance,
        isInsufficient: agg.isInsufficient,
        warnings: agg.warnings,
      });
    }

    return {
      items: rankedItems,
      normalizationRun: normalizationRun
        ? {
            id: normalizationRun.id,
            method: normalizationRun.method,
            version: normalizationRun.version,
          }
        : null,
      totalRanked: rankedItems.length,
      insufficientCount,
    };
  }

  /**
   * Creates an immutable, versioned result snapshot.
   */
  async createSnapshot(
    eventId: string,
    actorId: string,
    input: CreateResultSnapshotInput
  ) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    // 1. Generate current rankings
    const rankings = await this.generateRankings(eventId, {
      normalizationRunId: input.normalizationRunId,
      trackId: input.trackId,
    });

    if (rankings.items.length === 0) {
      throw new ValidationError(
        "No eligible projects available to rank. Submissions must be in 'SUBMITTED' or 'LOCKED' status."
      );
    }

    // 2. Override prizes if custom prize allocations were passed
    const prizeMap = new Map<string, string>();
    if (input.prizeAllocations) {
      for (const alloc of input.prizeAllocations) {
        prizeMap.set(alloc.submissionId, alloc.prizeId);
      }
    }

    // 3. Persist ResultSnapshot and ProjectResult records atomically
    const snapshot = await resultsRepository.createSnapshot({
      eventId,
      normalizationRunId: input.normalizationRunId || rankings.normalizationRun?.id,
      name: input.name,
      notes: input.notes,
      createdById: actorId,
      results: rankings.items.map((r) => ({
        submissionId: r.submissionId,
        trackId: r.trackId,
        prizeId: prizeMap.get(r.submissionId) || r.prizeId,
        rank: r.rank,
        trackRank: r.trackRank,
        rawAggregateScore: r.rawAggregateScore,
        normalizedScore: r.normalizedScore,
        finalScore: r.finalScore,
        scoreCount: r.scoreCount,
        metadata: {
          teamName: r.teamName,
          title: r.title,
          variance: r.variance.toFixed(4),
          warnings: r.warnings,
        },
      })),
    });

    // 4. Emit tamper-evident audit log
    await auditService.log({
      eventId,
      actorId,
      action: "RESULT_SNAPSHOT_CREATED",
      entityType: "ResultSnapshot",
      entityId: snapshot.id,
      metadata: {
        snapshotId: snapshot.id,
        version: snapshot.version,
        projectCount: rankings.items.length,
      },
    });

    return snapshot;
  }

  /**
   * Finalizes a result snapshot (DRAFT -> FINALIZED).
   */
  async finalizeSnapshot(eventId: string, snapshotId: string, actorId: string) {
    const snapshot = await resultsRepository.findSnapshotById(snapshotId);
    if (!snapshot || snapshot.eventId !== eventId) {
      throw new NotFoundError(`Result snapshot with ID '${snapshotId}' was not found.`);
    }

    if (snapshot.status === "PUBLISHED") {
      throw new ValidationError("Cannot modify an already published snapshot. Published snapshots are permanently immutable.");
    }

    const updated = await resultsRepository.updateSnapshotStatus(
      snapshotId,
      "FINALIZED",
      "finalizedAt"
    );

    await auditService.log({
      eventId,
      actorId,
      action: "RESULTS_FINALIZED",
      entityType: "ResultSnapshot",
      entityId: snapshotId,
      metadata: { snapshotId, version: snapshot.version },
    });

    return updated;
  }

  /**
   * Officially publishes a result snapshot.
   * Locks the snapshot as permanently immutable and updates public view.
   */
  async publishSnapshot(
    eventId: string,
    snapshotId: string,
    actorId: string,
    input: PublishResultsInput
  ) {
    const snapshot = await resultsRepository.findSnapshotById(snapshotId);
    if (!snapshot || snapshot.eventId !== eventId) {
      throw new NotFoundError(`Result snapshot with ID '${snapshotId}' was not found.`);
    }

    if (snapshot.status === "PUBLISHED") {
      return snapshot; // Idempotent
    }

    // 1. Mark snapshot as PUBLISHED
    const published = await resultsRepository.updateSnapshotStatus(
      snapshotId,
      "PUBLISHED",
      "publishedAt"
    );

    // 2. Mirror into legacy Result table for compatibility
    await resultsRepository.mirrorToLegacyResults(snapshotId, eventId);

    // 3. Optionally transition event state to RESULTS_PUBLISHED
    if (input.transitionEventState) {
      const event = await eventRepository.findEventBySlugOrId(eventId);
      if (event && (event.state === "JUDGING_CLOSED" || event.state === "JUDGING_OPEN")) {
        await prisma.event.update({
          where: { id: eventId },
          data: { state: "RESULTS_PUBLISHED" },
        });
      }
    }

    // 4. Emit tamper-evident audit log
    await auditService.log({
      eventId,
      actorId,
      action: "RESULTS_PUBLISHED",
      entityType: "ResultSnapshot",
      entityId: snapshotId,
      metadata: {
        snapshotId,
        version: snapshot.version,
        publishedAt: published.publishedAt,
      },
    });

    return published;
  }

  /**
   * Retrieves snapshots for an event.
   */
  async getSnapshots(eventId: string) {
    return resultsRepository.findSnapshotsByEvent(eventId);
  }

  /**
   * Retrieves snapshot by ID.
   */
  async getSnapshotById(snapshotId: string) {
    const snapshot = await resultsRepository.findSnapshotById(snapshotId);
    if (!snapshot) {
      throw new NotFoundError(`Result snapshot with ID '${snapshotId}' was not found.`);
    }
    return snapshot;
  }

  /**
   * Public results endpoint:
   * Returns sanitized official rankings from the active published snapshot.
   * Strictly protects private judge emails, raw individual scores, and calibration metrics.
   */
  async getPublicResults(eventSlugOrId: string) {
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: eventSlugOrId }, { slug: eventSlugOrId }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        description: true,
        updatedAt: true,
      },
    });

    if (!event) {
      throw new NotFoundError(`Event '${eventSlugOrId}' was not found.`);
    }

    const publishedSnapshot = await resultsRepository.findPublishedSnapshot(event.id);

    if (!publishedSnapshot) {
      // Compatibility fallback: check legacy published results table
      const legacyResults = await prisma.result.findMany({
        where: { eventId: event.id, isPublished: true },
        include: {
          submission: {
            include: { team: { select: { id: true, name: true, slug: true } } },
          },
          track: { select: { id: true, name: true, slug: true } },
          prize: { select: { id: true, name: true, value: true } },
        },
        orderBy: { rank: "asc" },
      });

      if (legacyResults.length > 0) {
        return {
          event,
          isPublished: true,
          publishedAt: event.updatedAt,
          version: 1,
          results: legacyResults.map((r) => ({
            id: r.id,
            rank: r.rank ?? 1,
            trackRank: null,
            finalScore: Number(r.finalScore).toFixed(2),
            submission: {
              id: r.submission.id,
              title: r.submission.title,
              description: r.submission.description,
              repositoryUrl: r.submission.repositoryUrl,
              demoUrl: r.submission.demoUrl,
              deploymentUrl: r.submission.deploymentUrl,
              documentationUrl: r.submission.documentationUrl,
              teamName: r.submission.team.name,
            },
            track: r.track ? { id: r.track.id, name: r.track.name } : null,
            prize: r.prize ? { id: r.prize.id, name: r.prize.name, value: r.prize.value } : null,
          })),
        };
      }

      return {
        event,
        isPublished: false,
        results: [],
        snapshot: null,
      };
    }

    // Safe sanitized public projection
    const sanitizedResults = publishedSnapshot.results.map((r) => ({
      id: r.id,
      rank: r.rank,
      trackRank: r.trackRank,
      finalScore: r.finalScore.toFixed(2),
      submission: {
        id: r.submission.id,
        title: r.submission.title,
        description: r.submission.description,
        repositoryUrl: r.submission.repositoryUrl,
        demoUrl: r.submission.demoUrl,
        deploymentUrl: r.submission.deploymentUrl,
        documentationUrl: r.submission.documentationUrl,
        teamName: r.submission.team.name,
      },
      track: r.track ? { id: r.track.id, name: r.track.name } : null,
      prize: r.prize ? { id: r.prize.id, name: r.prize.name, value: r.prize.value } : null,
    }));

    return {
      event,
      isPublished: true,
      publishedAt: publishedSnapshot.publishedAt,
      version: publishedSnapshot.version,
      results: sanitizedResults,
    };
  }
}

export const resultsService = new ResultsService();
