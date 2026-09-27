import { prisma } from "@/lib/db/prisma";
import { Prisma, type Rubric, type RubricVersion, type RubricCriterion } from "@prisma/client";

export type RubricWithDetails = Rubric & {
  versions: Array<
    RubricVersion & {
      criteria: RubricCriterion[];
      _count: { scores: number };
    }
  >;
  track: { id: string; name: string; slug: string } | null;
};

export type RubricVersionWithDetails = RubricVersion & {
  rubric: Rubric;
  criteria: RubricCriterion[];
  _count: { scores: number };
};

export interface CreateRubricData {
  eventId: string;
  trackId?: string | null;
  name: string;
  description?: string | null;
  criteria: Array<{
    name: string;
    description?: string | null;
    weight: number;
    maxScore: number;
    order: number;
  }>;
}

export class RubricRepository {
  /**
   * Retrieves all rubrics for an event with version and criteria graph.
   */
  async findRubricsByEvent(eventId: string): Promise<RubricWithDetails[]> {
    return prisma.rubric.findMany({
      where: { eventId },
      include: {
        track: { select: { id: true, name: true, slug: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            criteria: { orderBy: { order: "asc" } },
            _count: { select: { scores: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<RubricWithDetails[]>;
  }

  /**
   * Retrieves a rubric by unique ID with full relation graph.
   */
  async findRubricById(id: string): Promise<RubricWithDetails | null> {
    return prisma.rubric.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, name: true, slug: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            criteria: { orderBy: { order: "asc" } },
            _count: { select: { scores: true } },
          },
        },
      },
    }) as Promise<RubricWithDetails | null>;
  }

  /**
   * Retrieves a specific rubric version by ID.
   */
  async findRubricVersionById(versionId: string): Promise<RubricVersionWithDetails | null> {
    return prisma.rubricVersion.findUnique({
      where: { id: versionId },
      include: {
        rubric: true,
        criteria: { orderBy: { order: "asc" } },
        _count: { select: { scores: true } },
      },
    }) as Promise<RubricVersionWithDetails | null>;
  }

  /**
   * Finds the currently active rubric version for an event (and optional track).
   */
  async findActiveRubricVersionForEvent(
    eventId: string,
    trackId?: string | null
  ): Promise<RubricVersionWithDetails | null> {
    // If trackId provided, first check for track-specific active rubric
    if (trackId) {
      const trackRubric = await prisma.rubric.findFirst({
        where: { eventId, trackId },
        include: {
          versions: {
            where: { isActive: true },
            include: {
              rubric: true,
              criteria: { orderBy: { order: "asc" } },
              _count: { select: { scores: true } },
            },
            take: 1,
          },
        },
      });
      if (trackRubric && trackRubric.versions.length > 0) {
        return trackRubric.versions[0] as RubricVersionWithDetails;
      }
    }

    // Default to general event rubric (trackId is null)
    const generalRubric = await prisma.rubric.findFirst({
      where: { eventId, trackId: null },
      include: {
        versions: {
          where: { isActive: true },
          include: {
            rubric: true,
            criteria: { orderBy: { order: "asc" } },
            _count: { select: { scores: true } },
          },
          take: 1,
        },
      },
    });

    if (generalRubric && generalRubric.versions.length > 0) {
      return generalRubric.versions[0] as RubricVersionWithDetails;
    }

    // Fallback to any active rubric for this event
    const anyRubric = await prisma.rubric.findFirst({
      where: { eventId },
      include: {
        versions: {
          where: { isActive: true },
          include: {
            rubric: true,
            criteria: { orderBy: { order: "asc" } },
            _count: { select: { scores: true } },
          },
          take: 1,
        },
      },
    });

    return (anyRubric?.versions[0] as RubricVersionWithDetails) || null;
  }

  /**
   * Creates a rubric template with its initial version (v1) and criteria atomically.
   */
  async createRubricWithVersion(data: CreateRubricData): Promise<RubricWithDetails> {
    return prisma.$transaction(async (tx) => {
      const rubric = await tx.rubric.create({
        data: {
          eventId: data.eventId,
          trackId: data.trackId || null,
          name: data.name,
          description: data.description || null,
        },
      });

      const version = await tx.rubricVersion.create({
        data: {
          rubricId: rubric.id,
          versionNumber: 1,
          isActive: true,
        },
      });

      await tx.rubricCriterion.createMany({
        data: data.criteria.map((c, index) => ({
          rubricVersionId: version.id,
          name: c.name,
          description: c.description || null,
          weight: new Prisma.Decimal(c.weight),
          maxScore: new Prisma.Decimal(c.maxScore),
          order: c.order ?? index,
        })),
      });

      return tx.rubric.findUniqueOrThrow({
        where: { id: rubric.id },
        include: {
          track: { select: { id: true, name: true, slug: true } },
          versions: {
            orderBy: { versionNumber: "desc" },
            include: {
              criteria: { orderBy: { order: "asc" } },
              _count: { select: { scores: true } },
            },
          },
        },
      }) as Promise<RubricWithDetails>;
    });
  }

  /**
   * Creates a new version for an existing rubric with incremented version number.
   */
  async createRubricVersion(
    rubricId: string,
    criteria: Array<{
      name: string;
      description?: string | null;
      weight: number;
      maxScore: number;
      order: number;
    }>,
    activate: boolean = false
  ): Promise<RubricVersionWithDetails> {
    return prisma.$transaction(async (tx) => {
      const latestVersion = await tx.rubricVersion.findFirst({
        where: { rubricId },
        orderBy: { versionNumber: "desc" },
      });

      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      if (activate) {
        await tx.rubricVersion.updateMany({
          where: { rubricId },
          data: { isActive: false },
        });
      }

      const version = await tx.rubricVersion.create({
        data: {
          rubricId,
          versionNumber: nextVersionNumber,
          isActive: activate,
        },
      });

      await tx.rubricCriterion.createMany({
        data: criteria.map((c, index) => ({
          rubricVersionId: version.id,
          name: c.name,
          description: c.description || null,
          weight: new Prisma.Decimal(c.weight),
          maxScore: new Prisma.Decimal(c.maxScore),
          order: c.order ?? index,
        })),
      });

      return tx.rubricVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: {
          rubric: true,
          criteria: { orderBy: { order: "asc" } },
          _count: { select: { scores: true } },
        },
      }) as Promise<RubricVersionWithDetails>;
    });
  }

  /**
   * Sets a specific rubric version as active and deactivates other versions.
   */
  async publishRubricVersion(versionId: string): Promise<RubricVersionWithDetails> {
    return prisma.$transaction(async (tx) => {
      const target = await tx.rubricVersion.findUniqueOrThrow({
        where: { id: versionId },
      });

      // Deactivate all sibling versions
      await tx.rubricVersion.updateMany({
        where: { rubricId: target.rubricId },
        data: { isActive: false },
      });

      // Activate target
      await tx.rubricVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });

      return tx.rubricVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          rubric: true,
          criteria: { orderBy: { order: "asc" } },
          _count: { select: { scores: true } },
        },
      }) as Promise<RubricVersionWithDetails>;
    });
  }

  /**
   * Checks if any scores have been submitted using this rubric version.
   */
  async hasScores(rubricVersionId: string): Promise<boolean> {
    const count = await prisma.score.count({
      where: { rubricVersionId },
    });
    return count > 0;
  }
}

export const rubricRepository = new RubricRepository();
