import { prisma } from "@/lib/db/prisma";
import { Prisma, type Submission, type SubmissionState, type SubmissionVersion, type Team, type Track, type Event } from "@prisma/client";

export type SubmissionWithDetails = Submission & {
  team: Team & {
    members: Array<{
      id: string;
      userId: string;
      role: string;
      user: { id: string; name: string; email: string };
    }>;
  };
  event: Event;
  track: Track | null;
  versions: SubmissionVersion[];
};

export interface CreateDraftInput {
  eventId: string;
  teamId: string;
  creatorId: string;
  trackId?: string | null;
  title: string;
  description: string;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  deploymentUrl?: string | null;
  documentationUrl?: string | null;
  customData?: Prisma.InputJsonValue | Record<string, unknown> | null;
}

export interface UpdateDraftData {
  trackId?: string | null;
  title?: string;
  description?: string;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  deploymentUrl?: string | null;
  documentationUrl?: string | null;
  customData?: Prisma.InputJsonValue | Record<string, unknown> | null;
}

export interface GalleryFilterOptions {
  query?: string | null;
  search?: string | null;
  eventId?: string | null;
  trackId?: string | null;
  sort?: "newest" | "title_asc" | "title_desc" | "random";
  seed?: number;
  page?: number;
  limit?: number;
}

export class SubmissionRepository {
  /**
   * Retrieves submission by unique ID with full relation graph.
   */
  async findSubmissionById(id: string): Promise<SubmissionWithDetails | null> {
    return prisma.submission.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        event: true,
        track: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    }) as Promise<SubmissionWithDetails | null>;
  }

  /**
   * Retrieves the submission associated with a specific team.
   */
  async findSubmissionByTeamId(teamId: string): Promise<SubmissionWithDetails | null> {
    return prisma.submission.findUnique({
      where: { teamId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        event: true,
        track: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    }) as Promise<SubmissionWithDetails | null>;
  }

  /**
   * Retrieves a submission by compound eventId and teamId uniqueness constraint.
   */
  async findSubmissionByEventAndTeam(eventId: string, teamId: string): Promise<Submission | null> {
    return prisma.submission.findUnique({
      where: {
        eventId_teamId: { eventId, teamId },
      },
    });
  }

  /**
   * Lists all submissions for an event (used by organizer console).
   */
  async listSubmissionsForEvent(eventId: string): Promise<SubmissionWithDetails[]> {
    return prisma.submission.findMany({
      where: { eventId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        event: true,
        track: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<SubmissionWithDetails[]>;
  }

  /**
   * Creates a draft submission and its initial version snapshot atomically.
   */
  async createDraftWithVersion(input: CreateDraftInput): Promise<SubmissionWithDetails> {
    return prisma.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          eventId: input.eventId,
          teamId: input.teamId,
          trackId: input.trackId || null,
          title: input.title,
          description: input.description,
          repositoryUrl: input.repositoryUrl || null,
          demoUrl: input.demoUrl || null,
          deploymentUrl: input.deploymentUrl || null,
          documentationUrl: input.documentationUrl || null,
          customData: (input.customData as Prisma.InputJsonValue) ?? Prisma.DbNull,
          state: "DRAFT",
        },
      });

      await tx.submissionVersion.create({
        data: {
          submissionId: submission.id,
          versionNumber: 1,
          title: input.title,
          description: input.description,
          repositoryUrl: input.repositoryUrl || null,
          demoUrl: input.demoUrl || null,
          deploymentUrl: input.deploymentUrl || null,
          documentationUrl: input.documentationUrl || null,
          customData: (input.customData as Prisma.InputJsonValue) ?? Prisma.DbNull,
          snapshotData: {
            title: input.title,
            description: input.description,
            repositoryUrl: input.repositoryUrl || null,
            demoUrl: input.demoUrl || null,
            deploymentUrl: input.deploymentUrl || null,
            documentationUrl: input.documentationUrl || null,
            trackId: input.trackId || null,
            createdAs: "INITIAL_DRAFT",
            createdAt: new Date().toISOString(),
          },
          submittedById: input.creatorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.creatorId,
          eventId: input.eventId,
          action: "SUBMISSION_CREATED",
          entityType: "Submission",
          entityId: submission.id,
          metadata: {
            teamId: input.teamId,
            title: input.title,
            trackId: input.trackId || null,
          },
        },
      });

      return tx.submission.findUniqueOrThrow({
        where: { id: submission.id },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          event: true,
          track: true,
          versions: {
            orderBy: { versionNumber: "desc" },
          },
        },
      }) as Promise<SubmissionWithDetails>;
    });
  }

  /**
   * Updates fields of a draft submission.
   */
  async updateDraft(id: string, data: UpdateDraftData): Promise<Submission> {
    return prisma.submission.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.trackId !== undefined ? { trackId: data.trackId } : {}),
        ...(data.repositoryUrl !== undefined ? { repositoryUrl: data.repositoryUrl } : {}),
        ...(data.demoUrl !== undefined ? { demoUrl: data.demoUrl } : {}),
        ...(data.deploymentUrl !== undefined ? { deploymentUrl: data.deploymentUrl } : {}),
        ...(data.documentationUrl !== undefined ? { documentationUrl: data.documentationUrl } : {}),
        ...(data.customData !== undefined
          ? {
              customData:
                (data.customData as Prisma.InputJsonValue) ?? Prisma.DbNull,
            }
          : {}),
      },
    });
  }

  /**
   * Submits a project, freezing it into an official submission with a new version snapshot.
   */
  async finalizeSubmission(
    id: string,
    authorId: string
  ): Promise<SubmissionWithDetails> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.submission.findUniqueOrThrow({
        where: { id },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          event: true,
          track: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      });

      const nextVersionNumber = (current.versions[0]?.versionNumber || 0) + 1;
      const now = new Date();

      const updatedSubmission = await tx.submission.update({
        where: { id },
        data: {
          state: "SUBMITTED",
          submittedAt: now,
        },
      });

      await tx.submissionVersion.create({
        data: {
          submissionId: id,
          versionNumber: nextVersionNumber,
          title: current.title,
          description: current.description,
          repositoryUrl: current.repositoryUrl,
          demoUrl: current.demoUrl,
          deploymentUrl: current.deploymentUrl,
          documentationUrl: current.documentationUrl,
          customData: current.customData ?? Prisma.DbNull,
          snapshotData: {
            title: current.title,
            description: current.description,
            repositoryUrl: current.repositoryUrl,
            demoUrl: current.demoUrl,
            deploymentUrl: current.deploymentUrl,
            documentationUrl: current.documentationUrl,
            track: current.track
              ? { id: current.track.id, name: current.track.name, slug: current.track.slug }
              : null,
            team: {
              id: current.team.id,
              name: current.team.name,
              members: current.team.members.map((m) => ({
                userId: m.userId,
                name: m.user.name,
                role: m.role,
              })),
            },
            submittedAt: now.toISOString(),
          },
          submittedById: authorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: authorId,
          eventId: current.eventId,
          action: "SUBMISSION_SUBMITTED",
          entityType: "Submission",
          entityId: id,
          metadata: {
            versionNumber: nextVersionNumber,
            title: current.title,
          },
        },
      });

      return tx.submission.findUniqueOrThrow({
        where: { id: updatedSubmission.id },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          event: true,
          track: true,
          versions: {
            orderBy: { versionNumber: "desc" },
          },
        },
      }) as Promise<SubmissionWithDetails>;
    });
  }

  /**
   * Atomically transitions a submission's state with audit log recording.
   */
  async transitionState(
    id: string,
    newState: SubmissionState,
    actorId: string,
    metadata?: Record<string, unknown>
  ): Promise<SubmissionWithDetails> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.submission.findUniqueOrThrow({
        where: { id },
      });

      const dataToUpdate: Prisma.SubmissionUpdateInput = {
        state: newState,
      };

      if (newState === "LOCKED") {
        dataToUpdate.lockedAt = new Date();
      }

      if (metadata) {
        dataToUpdate.customData = metadata as Prisma.InputJsonValue;
      }

      const updated = await tx.submission.update({
        where: { id },
        data: dataToUpdate,
      });

      let actionName = `SUBMISSION_${newState}`;
      if (newState === "LOCKED") {
        actionName = "SUBMISSION_LOCKED";
      } else if (newState === "DISQUALIFIED") {
        actionName = "SUBMISSION_DISQUALIFIED";
      } else if (metadata?.restoredFrom) {
        actionName = "SUBMISSION_RESTORED";
      }

      await tx.auditLog.create({
        data: {
          actorId,
          eventId: current.eventId,
          action: actionName,
          entityType: "Submission",
          entityId: id,
          metadata: {
            previousState: current.state,
            newState,
            ...metadata,
          },
        },
      });

      return tx.submission.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          event: true,
          track: true,
          versions: {
            orderBy: { versionNumber: "desc" },
          },
        },
      }) as Promise<SubmissionWithDetails>;
    });
  }

  /**
   * Queries eligible submissions for the public gallery with search, filtering, and pagination.
   * Strictly filters for SUBMITTED or LOCKED submissions in non-DRAFT events.
   */
  async findPublicGallerySubmissions(options: GalleryFilterOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 12));
    const skip = (page - 1) * limit;

    const where: Prisma.SubmissionWhereInput = {
      state: { in: ["SUBMITTED", "LOCKED"] },
      event: {
        state: { not: "DRAFT" },
      },
    };

    if (options.eventId) {
      where.eventId = options.eventId;
    }

    if (options.trackId) {
      where.trackId = options.trackId;
    }

    const searchTerm = (options.query || options.search || "").trim();
    if (searchTerm !== "") {
      where.OR = [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
        { team: { name: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    // Determine ordering
    let orderBy: Prisma.SubmissionOrderByWithRelationInput[];
    switch (options.sort) {
      case "title_asc":
        orderBy = [{ title: "asc" }, { id: "asc" }];
        break;
      case "title_desc":
        orderBy = [{ title: "desc" }, { id: "desc" }];
        break;
      case "random": {
        // Deterministic pseudo-random sorting based on seed
        const seed = options.seed || 1337;
        const mod = Math.abs(seed) % 6;
        switch (mod) {
          case 0:
            orderBy = [{ submittedAt: "asc" }, { title: "desc" }, { id: "asc" }];
            break;
          case 1:
            orderBy = [{ title: "desc" }, { submittedAt: "desc" }, { id: "desc" }];
            break;
          case 2:
            orderBy = [{ title: "asc" }, { createdAt: "desc" }, { id: "asc" }];
            break;
          case 3:
            orderBy = [{ createdAt: "asc" }, { title: "asc" }, { id: "asc" }];
            break;
          case 4:
            orderBy = [{ submittedAt: "desc" }, { title: "asc" }, { id: "desc" }];
            break;
          default:
            orderBy = [{ trackId: "asc" }, { submittedAt: "desc" }, { id: "asc" }];
            break;
        }
        break;
      }
      case "newest":
      default:
        orderBy = [{ submittedAt: "desc" }, { createdAt: "desc" }];
        break;
    }

    const [items, totalCount] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { name: true } },
                },
              },
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              state: true,
              votingConfig: true,
            },
          },
          track: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { votes: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.submission.count({ where }),
    ]);

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
    };
  }

  /**
   * Finds an individual public submission by ID or slug.
   * Rejects projects in DRAFT or DISQUALIFIED states, or from DRAFT events.
   */
  async findPublicSubmissionById(id: string) {
    return prisma.submission.findFirst({
      where: {
        id,
        state: { in: ["SUBMITTED", "LOCKED"] },
        event: { state: { not: "DRAFT" } },
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            state: true,
            votingConfig: true,
          },
        },
        track: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { votes: true },
        },
        versions: {
          select: {
            id: true,
            versionNumber: true,
            createdAt: true,
          },
          orderBy: { versionNumber: "desc" },
        },
      },
    });
  }
}

export const submissionRepository = new SubmissionRepository();
