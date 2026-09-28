import { prisma } from "@/lib/db/prisma";
import type {
  VotingConfig,
  Vote,
  Comment,
  AbuseSignal,
  Prisma,
  CommentModerationStatus,
  AbuseSignalStatus,
  AbuseSignalSeverity,
  VotingEligibilityMode,
} from "@prisma/client";

export interface AggregatedSubmissionVote {
  submissionId: string;
  voteCount: number;
}

export interface SubmissionWithTeamDetails {
  id: string;
  eventId: string;
  teamId: string;
  state: string;
  team: {
    id: string;
    name: string;
    creatorId: string;
    members: {
      userId: string;
    }[];
  };
}

export class CommunityRepository {
  // ============================================================================
  // VOTING CONFIGURATION
  // ============================================================================

  async getVotingConfig(eventId: string): Promise<VotingConfig> {
    const existing = await prisma.votingConfig.findUnique({
      where: { eventId },
    });

    if (existing) {
      return existing;
    }

    // Check if eventId is a slug
    const event = await prisma.event.findFirst({
      where: { OR: [{ id: eventId }, { slug: eventId }] },
      select: { id: true },
    });

    if (event && event.id !== eventId) {
      const canonical = await prisma.votingConfig.findUnique({
        where: { eventId: event.id },
      });
      if (canonical) return canonical;
      return prisma.votingConfig.create({
        data: {
          eventId: event.id,
          isEnabled: false,
          eligibilityMode: "EVENT_PARTICIPANTS",
          allowParticipantVotes: true,
          allowJudgeVotes: true,
          allowOrganizerVotes: false,
          allowSelfVoting: false,
          publicVoteCounts: false,
          resultsPublished: false,
          randomizeGalleryOrder: false,
          galleryRandomSeed: 1337,
        },
      });
    }

    // Initialize default disabled config if none exists yet
    return prisma.votingConfig.create({
      data: {
        eventId,
        isEnabled: false,
        eligibilityMode: "EVENT_PARTICIPANTS",
        allowParticipantVotes: true,
        allowJudgeVotes: true,
        allowOrganizerVotes: false,
        allowSelfVoting: false,
        publicVoteCounts: false,
        resultsPublished: false,
        randomizeGalleryOrder: false,
        galleryRandomSeed: 1337,
      },
    });
  }

  async upsertVotingConfig(
    eventId: string,
    data: {
      isEnabled?: boolean;
      votingStart?: Date | null;
      votingEnd?: Date | null;
      eligibilityMode?: VotingEligibilityMode;
      allowParticipantVotes?: boolean;
      allowJudgeVotes?: boolean;
      allowOrganizerVotes?: boolean;
      allowSelfVoting?: boolean;
      publicVoteCounts?: boolean;
      resultsPublished?: boolean;
      resultsPublishedAt?: Date | null;
      randomizeGalleryOrder?: boolean;
      galleryRandomSeed?: number;
    }
  ): Promise<VotingConfig> {
    return prisma.votingConfig.upsert({
      where: { eventId },
      update: data,
      create: {
        eventId,
        ...data,
      },
    });
  }

  // ============================================================================
  // VOTES
  // ============================================================================

  async findVote(
    eventId: string,
    voterId: string,
    submissionId: string
  ): Promise<Vote | null> {
    return prisma.vote.findUnique({
      where: {
        eventId_voterId_submissionId: {
          eventId,
          voterId,
          submissionId,
        },
      },
    });
  }

  async castVote(
    eventId: string,
    voterId: string,
    submissionId: string
  ): Promise<Vote> {
    return prisma.vote.create({
      data: {
        eventId,
        voterId,
        submissionId,
      },
    });
  }

  async retractVote(
    eventId: string,
    voterId: string,
    submissionId: string
  ): Promise<Vote | null> {
    try {
      return await prisma.vote.delete({
        where: {
          eventId_voterId_submissionId: {
            eventId,
            voterId,
            submissionId,
          },
        },
      });
    } catch {
      return null;
    }
  }

  async getUserVotes(eventId: string, voterId: string): Promise<Vote[]> {
    return prisma.vote.findMany({
      where: { eventId, voterId },
      orderBy: { createdAt: "desc" },
    });
  }

  async countSubmissionVotes(submissionId: string): Promise<number> {
    return prisma.vote.count({
      where: { submissionId },
    });
  }

  async aggregateEventVotes(eventId: string): Promise<AggregatedSubmissionVote[]> {
    const counts = await prisma.vote.groupBy({
      by: ["submissionId"],
      where: { eventId },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    return counts.map((c) => ({
      submissionId: c.submissionId,
      voteCount: c._count.id,
    }));
  }

  async countTotalEventVotes(eventId: string): Promise<number> {
    return prisma.vote.count({
      where: { eventId },
    });
  }

  async countUniqueVoters(eventId: string): Promise<number> {
    const distinct = await prisma.vote.findMany({
      where: { eventId },
      distinct: ["voterId"],
      select: { voterId: true },
    });
    return distinct.length;
  }

  async findSubmissionWithTeam(
    submissionId: string
  ): Promise<SubmissionWithTeamDetails | null> {
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        eventId: true,
        teamId: true,
        state: true,
        team: {
          select: {
            id: true,
            name: true,
            creatorId: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    return sub as SubmissionWithTeamDetails | null;
  }

  // ============================================================================
  // COMMENTS
  // ============================================================================

  async createComment(data: {
    eventId: string;
    submissionId: string;
    userId: string;
    content: string;
  }): Promise<Comment> {
    return prisma.comment.create({
      data: {
        eventId: data.eventId,
        submissionId: data.submissionId,
        userId: data.userId,
        content: data.content,
        moderationStatus: "PUBLISHED",
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
  }

  async findSubmissionComments(
    submissionId: string,
    options: {
      page?: number;
      limit?: number;
      includeHidden?: boolean;
    } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CommentWhereInput = {
      submissionId,
      isDeleted: false,
    };

    if (!options.includeHidden) {
      where.moderationStatus = "PUBLISHED";
    }

    const [comments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      comments,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  async findEventComments(
    eventId: string,
    options: {
      status?: CommentModerationStatus;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 30));
    const skip = (page - 1) * limit;

    const where: Prisma.CommentWhereInput = {
      eventId,
      isDeleted: false,
    };

    if (options.status) {
      where.moderationStatus = options.status;
    }

    const [comments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          submission: { select: { id: true, title: true } },
          moderatedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      comments,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  async findCommentById(commentId: string): Promise<Comment | null> {
    return prisma.comment.findUnique({
      where: { id: commentId },
    });
  }

  async updateCommentStatus(
    commentId: string,
    status: CommentModerationStatus,
    moderatorId: string
  ): Promise<Comment> {
    return prisma.comment.update({
      where: { id: commentId },
      data: {
        moderationStatus: status,
        moderatedById: moderatorId,
        moderatedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // ABUSE SIGNALS
  // ============================================================================

  async createAbuseSignal(data: {
    eventId: string;
    submissionId?: string | null;
    userId?: string | null;
    signalType: string;
    severity?: AbuseSignalSeverity;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<AbuseSignal> {
    return prisma.abuseSignal.create({
      data: {
        eventId: data.eventId,
        submissionId: data.submissionId || null,
        userId: data.userId || null,
        signalType: data.signalType,
        severity: data.severity || "MEDIUM",
        description: data.description,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        status: "OPEN",
      },
    });
  }

  async findAbuseSignals(
    eventId: string,
    status?: AbuseSignalStatus
  ): Promise<AbuseSignal[]> {
    const where: Prisma.AbuseSignalWhereInput = { eventId };
    if (status) {
      where.status = status;
    }

    return prisma.abuseSignal.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        submission: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAbuseSignalById(signalId: string): Promise<AbuseSignal | null> {
    return prisma.abuseSignal.findUnique({
      where: { id: signalId },
    });
  }

  async updateAbuseSignal(
    signalId: string,
    data: {
      status: AbuseSignalStatus;
      reviewNotes?: string | null;
      reviewedById: string;
    }
  ): Promise<AbuseSignal> {
    return prisma.abuseSignal.update({
      where: { id: signalId },
      data: {
        status: data.status,
        reviewNotes: data.reviewNotes || null,
        reviewedById: data.reviewedById,
        reviewedAt: new Date(),
      },
    });
  }
}

export const communityRepository = new CommunityRepository();
