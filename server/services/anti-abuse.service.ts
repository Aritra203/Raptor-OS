import { InMemoryRateLimiter } from "@/server/auth/rate-limiter";
import { communityRepository } from "@/server/repositories/community.repository";
import { auditService } from "@/server/services/audit.service";
import { TooManyRequestsError, NotFoundError } from "@/lib/errors/app-error";
import type { AbuseSignalStatus, AbuseSignalSeverity } from "@prisma/client";

export const voteRateLimiter = new InMemoryRateLimiter();
export const commentRateLimiter = new InMemoryRateLimiter();

interface VelocityTracker {
  timestamps: number[];
}

interface FailedAttemptTracker {
  attempts: { timestamp: number; reason: string }[];
}

export class AntiAbuseService {
  private voteVelocityStore = new Map<string, VelocityTracker>();
  private failedAttemptStore = new Map<string, FailedAttemptTracker>();

  /**
   * Enforces rate limiting on community voting actions.
   * Limit: 10 vote actions per 60 seconds per user.
   */
  checkVoteRateLimit(voterId: string, ip?: string | null): void {
    const key = `vote:${voterId}`;
    const result = voteRateLimiter.check(key, 10, 60 * 1000);

    if (!result.allowed) {
      throw new TooManyRequestsError(
        `Vote rate limit exceeded. Please wait ${result.retryAfterSeconds} seconds before attempting another vote.`,
        result.retryAfterSeconds
      );
    }

    voteRateLimiter.hit(key, 60 * 1000);

    if (ip) {
      const ipKey = `vote:ip:${ip}`;
      const ipResult = voteRateLimiter.check(ipKey, 30, 60 * 1000);
      if (!ipResult.allowed) {
        throw new TooManyRequestsError(
          `Network rate limit exceeded. Please wait ${ipResult.retryAfterSeconds} seconds.`,
          ipResult.retryAfterSeconds
        );
      }
      voteRateLimiter.hit(ipKey, 60 * 1000);
    }
  }

  /**
   * Tracks successful vote frequency to detect high velocity bursts.
   * If >= 5 votes occur in <= 10 seconds, flags a HIGH_VELOCITY abuse signal.
   */
  async recordVoteActivity(
    eventId: string,
    voterId: string,
    submissionId: string
  ): Promise<void> {
    const now = Date.now();
    const windowMs = 10 * 1000; // 10 seconds
    const threshold = 5;

    let tracker = this.voteVelocityStore.get(voterId);
    if (!tracker) {
      tracker = { timestamps: [] };
      this.voteVelocityStore.set(voterId, tracker);
    }

    tracker.timestamps.push(now);
    tracker.timestamps = tracker.timestamps.filter((ts) => ts > now - windowMs);

    if (tracker.timestamps.length >= threshold) {
      await this.flagAbuseSignal({
        eventId,
        userId: voterId,
        submissionId,
        signalType: "HIGH_VELOCITY",
        severity: "HIGH",
        description: `High velocity voting detected: user cast ${tracker.timestamps.length} votes within 10 seconds.`,
        metadata: {
          recentVoteCount: tracker.timestamps.length,
          windowSeconds: 10,
        },
      });
      // Clear to avoid spamming duplicate signals for each subsequent click in the burst
      this.voteVelocityStore.delete(voterId);
    }
  }

  /**
   * Tracks failed voting or authorization attempts.
   * If >= 3 failures occur within 60 seconds, flags an abuse signal for organizer review.
   */
  async recordFailedAttempt(params: {
    eventId: string;
    userId: string;
    submissionId?: string | null;
    signalType: string;
    reason: string;
    severity?: AbuseSignalSeverity;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const threshold = 3;

    let tracker = this.failedAttemptStore.get(params.userId);
    if (!tracker) {
      tracker = { attempts: [] };
      this.failedAttemptStore.set(params.userId, tracker);
    }

    tracker.attempts.push({ timestamp: now, reason: params.reason });
    tracker.attempts = tracker.attempts.filter((a) => a.timestamp > now - windowMs);

    // If explicit severe attempt (like self-vote) or repeated failures
    if (params.signalType === "SELF_VOTE_ATTEMPT") {
      await this.flagAbuseSignal({
        eventId: params.eventId,
        userId: params.userId,
        submissionId: params.submissionId,
        signalType: "SELF_VOTE_ATTEMPT",
        severity: "MEDIUM",
        description: `Self-voting attempt detected: user attempted to vote for their own team project.`,
        metadata: params.metadata,
      });
    } else if (tracker.attempts.length >= threshold) {
      await this.flagAbuseSignal({
        eventId: params.eventId,
        userId: params.userId,
        submissionId: params.submissionId,
        signalType: params.signalType || "REPEATED_FAILED_ATTEMPTS",
        severity: params.severity || "MEDIUM",
        description: `Repeated failed voting attempts (${tracker.attempts.length} failures in 60s). Latest: ${params.reason}`,
        metadata: {
          failuresCount: tracker.attempts.length,
          recentReasons: tracker.attempts.map((a) => a.reason),
          ...params.metadata,
        },
      });
      this.failedAttemptStore.delete(params.userId);
    }
  }

  /**
   * Enforces rate limiting on comment submissions.
   * Limit: 5 comments per 60 seconds per user.
   */
  checkCommentRateLimit(userId: string, ip?: string | null): void {
    const key = `comment:${userId}`;
    const result = commentRateLimiter.check(key, 5, 60 * 1000);

    if (!result.allowed) {
      throw new TooManyRequestsError(
        `Comment rate limit exceeded. Please wait ${result.retryAfterSeconds} seconds before posting again.`,
        result.retryAfterSeconds
      );
    }

    commentRateLimiter.hit(key, 60 * 1000);

    if (ip) {
      const ipKey = `comment:ip:${ip}`;
      const ipResult = commentRateLimiter.check(ipKey, 20, 60 * 1000);
      if (!ipResult.allowed) {
        throw new TooManyRequestsError(
          `Network comment rate limit exceeded. Please wait ${ipResult.retryAfterSeconds} seconds.`,
          ipResult.retryAfterSeconds
        );
      }
      commentRateLimiter.hit(ipKey, 60 * 1000);
    }
  }

  /**
   * Records an auditable abuse signal for organizer review.
   * Never automatically deletes valid votes.
   */
  async flagAbuseSignal(data: {
    eventId: string;
    submissionId?: string | null;
    userId?: string | null;
    signalType: string;
    severity?: AbuseSignalSeverity;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    let canonicalEventId = data.eventId;
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const ev = await prisma.event.findFirst({
        where: { OR: [{ id: data.eventId }, { slug: data.eventId }] },
        select: { id: true },
      });
      if (ev) canonicalEventId = ev.id;
    } catch {
      // Fallback to provided eventId
    }

    const signal = await communityRepository.createAbuseSignal({
      ...data,
      eventId: canonicalEventId,
    });

    await auditService.log({
      eventId: canonicalEventId,
      actorId: data.userId || null,
      action: "ABUSE_SIGNAL_CREATED",
      entityType: "AbuseSignal",
      entityId: signal.id,
      metadata: {
        signalType: data.signalType,
        severity: data.severity || "MEDIUM",
        description: data.description,
      },
    });

    return signal;
  }

  async getAbuseSignals(eventId: string, status?: AbuseSignalStatus) {
    return communityRepository.findAbuseSignals(eventId, status);
  }

  async reviewAbuseSignal(
    signalId: string,
    actorId: string,
    status: AbuseSignalStatus,
    reviewNotes?: string | null
  ) {
    const existing = await communityRepository.findAbuseSignalById(signalId);
    if (!existing) {
      throw new NotFoundError(`Abuse signal '${signalId}' not found.`);
    }

    const updated = await communityRepository.updateAbuseSignal(signalId, {
      status,
      reviewNotes,
      reviewedById: actorId,
    });

    await auditService.log({
      eventId: existing.eventId,
      actorId,
      action: "ABUSE_SIGNAL_REVIEWED",
      entityType: "AbuseSignal",
      entityId: signalId,
      metadata: {
        previousStatus: existing.status,
        newStatus: status,
        reviewNotes: reviewNotes || null,
      },
    });

    return updated;
  }

  /**
   * Resets in-memory rate limiting stores (primarily for testing).
   */
  resetStores(): void {
    voteRateLimiter.clear();
    commentRateLimiter.clear();
    this.voteVelocityStore.clear();
    this.failedAttemptStore.clear();
  }
}

export const antiAbuseService = new AntiAbuseService();
