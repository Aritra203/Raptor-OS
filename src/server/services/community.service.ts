import { prisma } from "@/lib/db/prisma";
import { communityRepository } from "@/server/repositories/community.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { antiAbuseService } from "@/server/services/anti-abuse.service";
import { auditService } from "@/server/services/audit.service";
import { sanitizeCommentContent } from "@/lib/utils/comment-sanitizer";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors/app-error";
import type { SafeUser } from "@/server/services/auth.service";
import type { UpdateVotingConfigInput } from "@/lib/validations/community";
import { Prisma, CommentModerationStatus } from "@prisma/client";

export class CommunityService {
  // ============================================================================
  // VOTING CONFIGURATION
  // ============================================================================

  async getVotingConfig(eventId: string) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    const targetId = event ? event.id : eventId;
    return communityRepository.getVotingConfig(targetId);
  }

  async updateVotingConfig(
    eventId: string,
    actorId: string,
    input: UpdateVotingConfigInput
  ) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }
    const previous = await communityRepository.getVotingConfig(event.id);

    const updated = await communityRepository.upsertVotingConfig(event.id, {
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.votingStart !== undefined
        ? { votingStart: input.votingStart }
        : {}),
      ...(input.votingEnd !== undefined ? { votingEnd: input.votingEnd } : {}),
      ...(input.eligibilityMode !== undefined
        ? { eligibilityMode: input.eligibilityMode }
        : {}),
      ...(input.allowParticipantVotes !== undefined
        ? { allowParticipantVotes: input.allowParticipantVotes }
        : {}),
      ...(input.allowJudgeVotes !== undefined
        ? { allowJudgeVotes: input.allowJudgeVotes }
        : {}),
      ...(input.allowOrganizerVotes !== undefined
        ? { allowOrganizerVotes: input.allowOrganizerVotes }
        : {}),
      ...(input.allowSelfVoting !== undefined
        ? { allowSelfVoting: input.allowSelfVoting }
        : {}),
      ...(input.publicVoteCounts !== undefined
        ? { publicVoteCounts: input.publicVoteCounts }
        : {}),
      ...(input.resultsPublished !== undefined
        ? {
            resultsPublished: input.resultsPublished,
            resultsPublishedAt: input.resultsPublished ? new Date() : null,
          }
        : {}),
      ...(input.randomizeGalleryOrder !== undefined
        ? { randomizeGalleryOrder: input.randomizeGalleryOrder }
        : {}),
      ...(input.galleryRandomSeed !== undefined
        ? { galleryRandomSeed: input.galleryRandomSeed }
        : {}),
    });

    await auditService.log({
      eventId: event.id,
      actorId,
      action: "VOTING_CONFIG_UPDATED",
      entityType: "VotingConfig",
      entityId: updated.id,
      metadata: {
        previousEnabled: previous.isEnabled,
        newEnabled: updated.isEnabled,
        changes: input,
      },
    });

    return updated;
  }

  // ============================================================================
  // VOTING ACTIONS & VALIDATION
  // ============================================================================

  async castVote(params: {
    eventId: string;
    submissionId: string;
    voter: SafeUser;
    ip?: string | null;
  }) {
    const { eventId, submissionId, voter, ip } = params;

    // 1. Enforce rate limiting (10 attempts / 60s)
    antiAbuseService.checkVoteRateLimit(voter.id, ip);

    // 2. Fetch event and voting configuration
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }

    const config = await communityRepository.getVotingConfig(event.id);

    if (event.state === "ARCHIVED" || event.state === "DRAFT") {
      throw new ForbiddenError(
        `Voting is not permitted while event is in state '${event.state}'.`
      );
    }

    // 3. Verify voting is enabled
    if (!config.isEnabled) {
      await antiAbuseService.recordFailedAttempt({
        eventId: event.id,
        userId: voter.id,
        submissionId,
        signalType: "VOTING_DISABLED_ATTEMPT",
        reason: "User attempted to vote while community voting is disabled.",
      });
      throw new ForbiddenError(
        "Community voting is currently disabled for this event."
      );
    }

    // 4. Verify voting window
    const now = new Date();
    if (config.votingStart && now < new Date(config.votingStart)) {
      await antiAbuseService.recordFailedAttempt({
        eventId: event.id,
        userId: voter.id,
        submissionId,
        signalType: "VOTING_WINDOW_VIOLATION",
        reason: "User attempted to vote before configured voting start time.",
      });
      throw new ForbiddenError(
        `Community voting has not opened yet. Voting opens on ${new Date(
          config.votingStart
        ).toLocaleString()}.`
      );
    }

    if (config.votingEnd && now > new Date(config.votingEnd)) {
      await antiAbuseService.recordFailedAttempt({
        eventId: event.id,
        userId: voter.id,
        submissionId,
        signalType: "VOTING_WINDOW_VIOLATION",
        reason: "User attempted to vote after configured voting end time.",
      });
      throw new ForbiddenError(
        `Community voting has ended. Voting closed on ${new Date(
          config.votingEnd
        ).toLocaleString()}.`
      );
    }

    // 5. Verify target submission eligibility & cross-event isolation
    const submission = await communityRepository.findSubmissionWithTeam(
      submissionId
    );

    if (!submission || submission.eventId !== event.id) {
      throw new NotFoundError(
        `Submission '${submissionId}' was not found in event '${eventId}'.`
      );
    }

    if (submission.state !== "SUBMITTED" && submission.state !== "LOCKED") {
      throw new ForbiddenError(
        `Submission is not eligible for community voting (current state: '${submission.state}').`
      );
    }

    // 6. Verify voter eligibility
    let membership = voter.eventMemberships?.find(
      (m) => m.eventId === event.id && m.status === "ACTIVE"
    );

    if (!membership) {
      const dbMem = await prisma.eventMembership.findFirst({
        where: {
          eventId: event.id,
          userId: voter.id,
          status: "ACTIVE",
        },
      });
      if (dbMem) {
        membership = dbMem;
      }
    }

    if (config.eligibilityMode === "EVENT_PARTICIPANTS") {
      if (!membership) {
        await antiAbuseService.recordFailedAttempt({
          eventId: event.id,
          userId: voter.id,
          submissionId,
          signalType: "INELIGIBLE_VOTER_ATTEMPT",
          reason: "Unregistered user attempted to vote in participants-only event.",
        });
        throw new ForbiddenError(
          "Voting is restricted to active registered participants of this event."
        );
      }

      if (membership.role === "PARTICIPANT" && !config.allowParticipantVotes) {
        throw new ForbiddenError("Participant voting is disabled for this event.");
      }

      if (membership.role === "JUDGE" && !config.allowJudgeVotes) {
        throw new ForbiddenError("Judge community voting is disabled for this event.");
      }

      if (
        (membership.role === "ORGANIZER" || membership.role === "ADMIN") &&
        !config.allowOrganizerVotes
      ) {
        throw new ForbiddenError("Organizer voting is disabled for this event.");
      }
    }

    // 7. Check self-voting rules
    if (!config.allowSelfVoting) {
      const isTeamCreator = submission.team.creatorId === voter.id;
      const isTeamMember = submission.team.members.some(
        (m) => m.userId === voter.id
      );

      if (isTeamCreator || isTeamMember) {
        await antiAbuseService.recordFailedAttempt({
          eventId: event.id,
          userId: voter.id,
          submissionId,
          signalType: "SELF_VOTE_ATTEMPT",
          reason: "User attempted to self-vote for their own team project.",
          metadata: { teamId: submission.teamId },
        });
        throw new ForbiddenError(
          "Self-voting is prohibited. You cannot vote for your own team's project."
        );
      }
    }

    // 8. Database atomic vote creation with unique constraint race handling
    let vote;
    try {
      vote = await communityRepository.castVote(event.id, voter.id, submissionId);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        await antiAbuseService.recordFailedAttempt({
          eventId: event.id,
          userId: voter.id,
          submissionId,
          signalType: "DUPLICATE_VOTE_ATTEMPT",
          reason: "User attempted duplicate vote for the same project.",
        });
        throw new ConflictError(
          "You have already cast an active vote for this project."
        );
      }
      throw err;
    }

    // 9. Record velocity activity
    await antiAbuseService.recordVoteActivity(event.id, voter.id, submissionId);

    // 10. Audit log
    await auditService.log({
      eventId: event.id,
      actorId: voter.id,
      action: "VOTE_CAST",
      entityType: "Vote",
      entityId: vote.id,
      metadata: {
        submissionId,
        teamId: submission.teamId,
      },
    });

    return {
      success: true,
      voteId: vote.id,
    };
  }

  async retractVote(params: {
    eventId: string;
    submissionId: string;
    voterId: string;
  }) {
    const { eventId, submissionId, voterId } = params;

    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }

    // Verify voting configuration is active
    const config = await communityRepository.getVotingConfig(event.id);
    if (!config.isEnabled) {
      throw new ForbiddenError(
        "Community voting is not currently active for this event."
      );
    }

    const deleted = await communityRepository.retractVote(
      event.id,
      voterId,
      submissionId
    );

    if (!deleted) {
      throw new NotFoundError(
        "No active vote found for this project to retract."
      );
    }

    await auditService.log({
      eventId: event.id,
      actorId: voterId,
      action: "VOTE_RETRACTED",
      entityType: "Vote",
      entityId: deleted.id,
      metadata: {
        submissionId,
      },
    });

    return { success: true, voteId: deleted.id, retracted: true };
  }

  async getUserVoteStatus(
    eventId: string,
    submissionId: string,
    voterId: string
  ) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    const targetId = event ? event.id : eventId;
    const vote = await communityRepository.findVote(
      targetId,
      voterId,
      submissionId
    );
    return {
      hasVoted: Boolean(vote),
      voteId: vote ? vote.id : null,
      votedAt: vote ? vote.createdAt.toISOString() : null,
    };
  }

  async getSubmissionVoteStatus(
    eventId: string,
    submissionId: string,
    voterId: string
  ) {
    return this.getUserVoteStatus(eventId, submissionId, voterId);
  }

  // ============================================================================
  // VOTE RESULTS & AGGREGATION
  // ============================================================================

  async getCommunityResults(eventId: string, isOrganizer: boolean = false) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }
    const config = await communityRepository.getVotingConfig(event.id);

    // Strict hidden results enforcement
    const isPubliclyVisible =
      config.publicVoteCounts || config.resultsPublished;

    if (!isOrganizer && !isPubliclyVisible) {
      return {
        isPublished: false,
        resultsHidden: true,
        totalVotes: null,
        uniqueVoters: null,
        items: [],
      };
    }

    const [aggregates, totalVotes, uniqueVoters] = await Promise.all([
      communityRepository.aggregateEventVotes(event.id),
      communityRepository.countTotalEventVotes(event.id),
      communityRepository.countUniqueVoters(event.id),
    ]);

    // Rank items deterministically: voteCount DESC, submissionId ASC
    const ranked = aggregates.map((item, index) => ({
      rank: index + 1,
      submissionId: item.submissionId,
      voteCount: item.voteCount,
    }));

    return {
      isPublished: config.resultsPublished,
      resultsHidden: false,
      totalVotes,
      uniqueVoters,
      items: ranked,
    };
  }

  async publishCommunityResults(
    eventId: string,
    actorId: string,
    publish: boolean = true
  ) {
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }

    const updated = await communityRepository.upsertVotingConfig(event.id, {
      resultsPublished: publish,
      resultsPublishedAt: publish ? new Date() : null,
    });

    await auditService.log({
      eventId: event.id,
      actorId,
      action: publish
        ? "COMMUNITY_RESULTS_PUBLISHED"
        : "COMMUNITY_RESULTS_UNPUBLISHED",
      entityType: "VotingConfig",
      entityId: updated.id,
      metadata: {
        publishedAt: updated.resultsPublishedAt,
      },
    });

    return updated;
  }

  // ============================================================================
  // COMMENTS & MODERATION
  // ============================================================================

  async createComment(params: {
    eventId: string;
    submissionId: string;
    author: SafeUser;
    content: string;
    ip?: string | null;
  }) {
    const { eventId, submissionId, author, content, ip } = params;

    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError(`Event '${eventId}' not found.`);
    }

    // 1. Enforce comment rate limiting
    antiAbuseService.checkCommentRateLimit(author.id, ip);

    // 2. Validate & sanitize comment text (stripping HTML, XSS vectors)
    const cleanContent = sanitizeCommentContent(content, {
      minLength: 2,
      maxLength: 1000,
    });

    // 3. Verify submission exists and belongs to event
    const submission = await communityRepository.findSubmissionWithTeam(
      submissionId
    );

    if (!submission || submission.eventId !== event.id) {
      throw new NotFoundError(
        `Submission '${submissionId}' not found in event '${eventId}'.`
      );
    }

    if (submission.state !== "SUBMITTED" && submission.state !== "LOCKED") {
      throw new ForbiddenError(
        "Comments are permitted only on submitted or locked projects."
      );
    }

    const comment = await communityRepository.createComment({
      eventId: event.id,
      submissionId,
      userId: author.id,
      content: cleanContent,
    });

    await auditService.log({
      eventId: event.id,
      actorId: author.id,
      action: "COMMENT_POSTED",
      entityType: "Comment",
      entityId: comment.id,
      metadata: {
        submissionId,
        contentLength: cleanContent.length,
      },
    });

    return {
      id: comment.id,
      content: comment.content,
      moderationStatus: comment.moderationStatus,
      createdAt: comment.createdAt.toISOString(),
      user: {
        name: author.name,
      },
    };
  }

  async getSubmissionComments(
    submissionId: string,
    options: { page?: number; limit?: number; isOrganizer?: boolean } = {}
  ) {
    const { comments, totalCount, page, limit, totalPages } =
      await communityRepository.findSubmissionComments(submissionId, {
        page: options.page,
        limit: options.limit,
        includeHidden: Boolean(options.isOrganizer),
      });

    const safeComments = comments.map((c) => ({
      id: c.id,
      content: c.content,
      moderationStatus: c.moderationStatus,
      createdAt: c.createdAt.toISOString(),
      user: {
        name: c.user.name,
      },
    }));

    return {
      comments: safeComments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getEventComments(
    eventId: string,
    options: {
      status?: CommentModerationStatus;
      page?: number;
      limit?: number;
    } = {}
  ) {
    return communityRepository.findEventComments(eventId, options);
  }

  async moderateComment(
    commentId: string,
    actorId: string,
    status: CommentModerationStatus
  ) {
    const comment = await communityRepository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError(`Comment '${commentId}' not found.`);
    }

    const previousStatus = comment.moderationStatus;
    const updated = await communityRepository.updateCommentStatus(
      commentId,
      status,
      actorId
    );

    await auditService.log({
      eventId: comment.eventId,
      actorId,
      action: "COMMENT_MODERATED",
      entityType: "Comment",
      entityId: commentId,
      metadata: {
        previousStatus,
        newStatus: status,
      },
    });

    return updated;
  }
}

export const communityService = new CommunityService();
