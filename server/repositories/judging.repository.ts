import { prisma } from "@/lib/db/prisma";
import {
  Prisma,
  type AssignmentBatch,
  type JudgeAssignment,
  type Score,
  type ScoreItem,
  type AssignmentStatus,
} from "@prisma/client";

export type JudgeAssignmentWithDetails = JudgeAssignment & {
  judge: { id: string; name: string; email: string };
  submission: {
    id: string;
    title: string;
    description: string;
    repositoryUrl: string | null;
    demoUrl: string | null;
    deploymentUrl: string | null;
    documentationUrl: string | null;
    state: string;
    team: {
      id: string;
      name: string;
      members: Array<{ userId: string; role: string; user: { name: string } }>;
    };
    track: { id: string; name: string; slug: string } | null;
  };
  event: {
    id: string;
    name: string;
    state: string;
    judgingStart: Date | null;
    judgingEnd: Date | null;
  };
  score?: (Score & { items: ScoreItem[] }) | null;
};

export type ScoreWithDetails = Score & {
  items: Array<ScoreItem & { criterion: { name: string; weight: Prisma.Decimal; maxScore: Prisma.Decimal } }>;
  rubricVersion: {
    id: string;
    versionNumber: number;
    rubric: { name: string };
    criteria: Array<{ id: string; name: string; description: string | null; weight: Prisma.Decimal; maxScore: Prisma.Decimal; order: number }>;
  };
};

export interface CreateBatchData {
  eventId: string;
  createdById: string;
  algorithm: string;
  targetCoverage: number;
  submissionCount: number;
  judgeCount: number;
  assignmentCount: number;
  parameters?: Prisma.InputJsonValue;
  assignments: Array<{
    eventId: string;
    judgeId: string;
    submissionId: string;
  }>;
}

export interface SaveScoreInput {
  eventId: string;
  judgeId: string;
  submissionId: string;
  rubricVersionId: string;
  assignmentId: string;
  feedback?: string | null;
  items: Array<{
    criterionId: string;
    rawScore: number | string;
    feedback?: string | null;
  }>;
}

export class JudgingRepository {
  /**
   * Atomically records an AssignmentBatch and all generated JudgeAssignment records.
   */
  async createAssignmentBatch(data: CreateBatchData): Promise<AssignmentBatch> {
    return prisma.$transaction(async (tx) => {
      const batch = await tx.assignmentBatch.create({
        data: {
          eventId: data.eventId,
          createdById: data.createdById,
          algorithm: data.algorithm,
          targetCoverage: data.targetCoverage,
          submissionCount: data.submissionCount,
          judgeCount: data.judgeCount,
          assignmentCount: data.assignmentCount,
          parameters: data.parameters ?? Prisma.DbNull,
          status: "COMPLETED",
        },
      });

      if (data.assignments.length > 0) {
        await tx.judgeAssignment.createMany({
          data: data.assignments.map((a) => ({
            eventId: a.eventId,
            judgeId: a.judgeId,
            submissionId: a.submissionId,
            batchId: batch.id,
            status: "PENDING" as AssignmentStatus,
          })),
          skipDuplicates: true,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: data.createdById,
          eventId: data.eventId,
          action: "JUDGE_ASSIGNMENTS_GENERATED",
          entityType: "AssignmentBatch",
          entityId: batch.id,
          metadata: {
            targetCoverage: data.targetCoverage,
            assignmentsCreated: data.assignments.length,
            submissionCount: data.submissionCount,
            judgeCount: data.judgeCount,
          },
        },
      });

      return batch;
    });
  }

  /**
   * Lists all assignment batches generated for an event.
   */
  async findAssignmentBatchesByEvent(eventId: string): Promise<Array<AssignmentBatch & { createdBy: { name: string; email: string } }>> {
    return prisma.assignmentBatch.findMany({
      where: { eventId },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Retrieves an assignment by ID with full relation graph.
   */
  async findAssignmentById(id: string): Promise<JudgeAssignmentWithDetails | null> {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: { id },
      include: {
        judge: { select: { id: true, name: true, email: true } },
        submission: {
          select: {
            id: true,
            title: true,
            description: true,
            repositoryUrl: true,
            demoUrl: true,
            deploymentUrl: true,
            documentationUrl: true,
            state: true,
            team: {
              select: {
                id: true,
                name: true,
                members: {
                  select: {
                    userId: true,
                    role: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
            track: { select: { id: true, name: true, slug: true } },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            state: true,
            judgingStart: true,
            judgingEnd: true,
          },
        },
      },
    });

    if (!assignment) return null;

    // Attach existing score if any
    const score = await prisma.score.findFirst({
      where: {
        eventId: assignment.eventId,
        judgeId: assignment.judgeId,
        submissionId: assignment.submissionId,
      },
      include: { items: true },
    });

    return {
      ...assignment,
      score,
    } as JudgeAssignmentWithDetails;
  }

  /**
   * Finds all assignments for a specific judge, optionally filtered by event.
   */
  async findJudgeAssignments(
    judgeId: string,
    eventId?: string
  ): Promise<JudgeAssignmentWithDetails[]> {
    const assignments = await prisma.judgeAssignment.findMany({
      where: {
        judgeId,
        ...(eventId ? { eventId } : {}),
      },
      include: {
        judge: { select: { id: true, name: true, email: true } },
        submission: {
          select: {
            id: true,
            title: true,
            description: true,
            repositoryUrl: true,
            demoUrl: true,
            deploymentUrl: true,
            documentationUrl: true,
            state: true,
            team: {
              select: {
                id: true,
                name: true,
                members: {
                  select: {
                    userId: true,
                    role: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
            track: { select: { id: true, name: true, slug: true } },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            state: true,
            judgingStart: true,
            judgingEnd: true,
          },
        },
      },
      orderBy: [{ eventId: "asc" }, { assignedAt: "desc" }],
    });

    // Fetch related scores in bulk
    const submissionIds = assignments.map((a) => a.submissionId);
    const scores = await prisma.score.findMany({
      where: {
        judgeId,
        submissionId: { in: submissionIds },
      },
      include: { items: true },
    });

    const scoreMap = new Map<string, Score & { items: ScoreItem[] }>();
    for (const sc of scores) {
      scoreMap.set(`${sc.judgeId}_${sc.submissionId}`, sc);
    }

    return assignments.map((a) => ({
      ...a,
      score: scoreMap.get(`${a.judgeId}_${a.submissionId}`) || null,
    })) as JudgeAssignmentWithDetails[];
  }

  /**
   * Lists assignments for an event (organizer inspection).
   */
  async findEventAssignments(
    eventId: string,
    filters?: { submissionId?: string; judgeId?: string; status?: AssignmentStatus }
  ): Promise<JudgeAssignmentWithDetails[]> {
    return prisma.judgeAssignment.findMany({
      where: {
        eventId,
        ...(filters?.submissionId ? { submissionId: filters.submissionId } : {}),
        ...(filters?.judgeId ? { judgeId: filters.judgeId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: {
        judge: { select: { id: true, name: true, email: true } },
        submission: {
          select: {
            id: true,
            title: true,
            description: true,
            repositoryUrl: true,
            demoUrl: true,
            deploymentUrl: true,
            documentationUrl: true,
            state: true,
            team: {
              select: {
                id: true,
                name: true,
                members: {
                  select: {
                    userId: true,
                    role: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
            track: { select: { id: true, name: true, slug: true } },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            state: true,
            judgingStart: true,
            judgingEnd: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    }) as Promise<JudgeAssignmentWithDetails[]>;
  }

  /**
   * Retrieves score by judge, submission, and rubric version.
   */
  async findScore(
    judgeId: string,
    submissionId: string,
    rubricVersionId: string
  ): Promise<ScoreWithDetails | null> {
    return prisma.score.findUnique({
      where: {
        judgeId_submissionId_rubricVersionId: {
          judgeId,
          submissionId,
          rubricVersionId,
        },
      },
      include: {
        items: {
          include: {
            criterion: {
              select: { name: true, weight: true, maxScore: true },
            },
          },
        },
        rubricVersion: {
          include: {
            rubric: { select: { name: true } },
            criteria: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    }) as Promise<ScoreWithDetails | null>;
  }

  /**
   * Saves or updates a draft score.
   */
  async saveScoreDraft(data: SaveScoreInput): Promise<Score> {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert Score record as draft (isFinal: false)
      const score = await tx.score.upsert({
        where: {
          judgeId_submissionId_rubricVersionId: {
            judgeId: data.judgeId,
            submissionId: data.submissionId,
            rubricVersionId: data.rubricVersionId,
          },
        },
        create: {
          eventId: data.eventId,
          judgeId: data.judgeId,
          submissionId: data.submissionId,
          rubricVersionId: data.rubricVersionId,
          feedback: data.feedback || null,
          isFinal: false,
        },
        update: {
          feedback: data.feedback || null,
          isFinal: false,
        },
      });

      // 2. Upsert score items
      for (const item of data.items) {
        await tx.scoreItem.upsert({
          where: {
            scoreId_criterionId: {
              scoreId: score.id,
              criterionId: item.criterionId,
            },
          },
          create: {
            scoreId: score.id,
            criterionId: item.criterionId,
            rawScore: new Prisma.Decimal(item.rawScore),
            feedback: item.feedback || null,
          },
          update: {
            rawScore: new Prisma.Decimal(item.rawScore),
            feedback: item.feedback || null,
          },
        });
      }

      // 3. Mark assignment as IN_PROGRESS if currently PENDING
      await tx.judgeAssignment.updateMany({
        where: {
          id: data.assignmentId,
          status: "PENDING",
        },
        data: { status: "IN_PROGRESS" },
      });

      return score;
    });
  }

  /**
   * Finalizes score atomically and marks assignment completed.
   * Finalized score becomes immutable historical evidence.
   */
  async finalizeScore(
    data: SaveScoreInput,
    actorId: string
  ): Promise<ScoreWithDetails> {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert score as final
      const score = await tx.score.upsert({
        where: {
          judgeId_submissionId_rubricVersionId: {
            judgeId: data.judgeId,
            submissionId: data.submissionId,
            rubricVersionId: data.rubricVersionId,
          },
        },
        create: {
          eventId: data.eventId,
          judgeId: data.judgeId,
          submissionId: data.submissionId,
          rubricVersionId: data.rubricVersionId,
          feedback: data.feedback || null,
          isFinal: true,
        },
        update: {
          feedback: data.feedback || null,
          isFinal: true,
        },
      });

      // 2. Upsert all ScoreItems
      for (const item of data.items) {
        await tx.scoreItem.upsert({
          where: {
            scoreId_criterionId: {
              scoreId: score.id,
              criterionId: item.criterionId,
            },
          },
          create: {
            scoreId: score.id,
            criterionId: item.criterionId,
            rawScore: new Prisma.Decimal(item.rawScore),
            feedback: item.feedback || null,
          },
          update: {
            rawScore: new Prisma.Decimal(item.rawScore),
            feedback: item.feedback || null,
          },
        });
      }

      // 3. Complete the JudgeAssignment
      await tx.judgeAssignment.update({
        where: { id: data.assignmentId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId,
          eventId: data.eventId,
          action: "SCORE_FINALIZED",
          entityType: "Score",
          entityId: score.id,
          metadata: {
            submissionId: data.submissionId,
            judgeId: data.judgeId,
            rubricVersionId: data.rubricVersionId,
            itemCount: data.items.length,
          },
        },
      });

      return tx.score.findUniqueOrThrow({
        where: { id: score.id },
        include: {
          items: {
            include: {
              criterion: { select: { name: true, weight: true, maxScore: true } },
            },
          },
          rubricVersion: {
            include: {
              rubric: { select: { name: true } },
              criteria: { orderBy: { order: "asc" } },
            },
          },
        },
      }) as Promise<ScoreWithDetails>;
    });
  }

  /**
   * Revokes an existing assignment (marks as EXCUSED).
   */
  async revokeAssignment(assignmentId: string, actorId: string, eventId: string): Promise<JudgeAssignment> {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.judgeAssignment.update({
        where: { id: assignmentId },
        data: { status: "EXCUSED" },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          eventId,
          action: "JUDGE_ASSIGNMENT_REVOKED",
          entityType: "JudgeAssignment",
          entityId: assignmentId,
          metadata: { judgeId: assignment.judgeId, submissionId: assignment.submissionId },
        },
      });

      return assignment;
    });
  }

  /**
   * Retrieves real-time event judging progress metrics.
   */
  async getJudgingProgress(eventId: string) {
    const [
      totalSubmissions,
      eligibleSubmissions,
      totalJudges,
      assignments,
      finalizedScoresCount,
      judgeUsers,
      submissionsList,
    ] = await Promise.all([
      prisma.submission.count({ where: { eventId } }),
      prisma.submission.count({
        where: {
          eventId,
          state: { in: ["SUBMITTED", "LOCKED"] },
        },
      }),
      prisma.eventMembership.count({
        where: { eventId, role: "JUDGE", status: "ACTIVE" },
      }),
      prisma.judgeAssignment.findMany({
        where: { eventId },
        select: {
          id: true,
          status: true,
          judgeId: true,
          submissionId: true,
        },
      }),
      prisma.score.count({
        where: { eventId, isFinal: true },
      }),
      prisma.user.findMany({
        where: {
          eventMemberships: {
            some: { eventId, role: "JUDGE", status: "ACTIVE" },
          },
        },
        select: { id: true, name: true, email: true },
      }),
      prisma.submission.findMany({
        where: { eventId, state: { in: ["SUBMITTED", "LOCKED"] } },
        select: { id: true, title: true, team: { select: { name: true } } },
      }),
    ]);

    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
    const inProgressAssignments = assignments.filter((a) => a.status === "IN_PROGRESS").length;
    const pendingAssignments = assignments.filter((a) => a.status === "PENDING").length;

    // Submissions coverage
    const assignmentsPerSubmission = new Map<string, number>();
    const completedPerSubmission = new Map<string, number>();

    for (const a of assignments) {
      if (a.status !== "EXCUSED") {
        assignmentsPerSubmission.set(
          a.submissionId,
          (assignmentsPerSubmission.get(a.submissionId) || 0) + 1
        );
        if (a.status === "COMPLETED") {
          completedPerSubmission.set(
            a.submissionId,
            (completedPerSubmission.get(a.submissionId) || 0) + 1
          );
        }
      }
    }

    // Workload per judge
    const judgeWorkloadsMap = new Map<
      string,
      { total: number; completed: number; inProgress: number; pending: number }
    >();

    for (const u of judgeUsers) {
      judgeWorkloadsMap.set(u.id, { total: 0, completed: 0, inProgress: 0, pending: 0 });
    }

    for (const a of assignments) {
      if (a.status !== "EXCUSED") {
        const current = judgeWorkloadsMap.get(a.judgeId) || {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
        };
        current.total += 1;
        if (a.status === "COMPLETED") current.completed += 1;
        else if (a.status === "IN_PROGRESS") current.inProgress += 1;
        else if (a.status === "PENDING") current.pending += 1;
        judgeWorkloadsMap.set(a.judgeId, current);
      }
    }

    const completionRate =
      totalAssignments > 0
        ? Number(((completedAssignments / totalAssignments) * 100).toFixed(1))
        : 0;

    const judgeUserMap = new Map(judgeUsers.map((u) => [u.id, u]));

    const judgeWorkload = Array.from(judgeWorkloadsMap.entries()).map(([judgeId, stats]) => {
      const u = judgeUserMap.get(judgeId);
      const cRate = stats.total > 0 ? Number(((stats.completed / stats.total) * 100).toFixed(1)) : 0;
      return {
        judgeId,
        judgeName: u?.name || "Judge",
        judgeEmail: u?.email || "",
        total: stats.total,
        completed: stats.completed,
        inProgress: stats.inProgress,
        pending: stats.pending,
        completionRate: cRate,
      };
    });

    const submissionCoverage = submissionsList.map((s) => {
      const totalAssigned = assignmentsPerSubmission.get(s.id) || 0;
      const completedCount = completedPerSubmission.get(s.id) || 0;
      return {
        submissionId: s.id,
        submissionTitle: s.title,
        teamName: s.team.name,
        totalAssigned,
        completedCount,
        isFullyEvaluated: totalAssigned > 0 && completedCount >= totalAssigned,
      };
    });

    const fullyEvaluatedCount = submissionCoverage.filter((s) => s.isFullyEvaluated).length;
    const underEvaluatedCount = submissionCoverage.filter((s) => s.totalAssigned > 0 && !s.isFullyEvaluated).length;

    const overview = {
      totalAssignments,
      completedAssignments,
      inProgressAssignments,
      pendingAssignments,
      completionRate,
      scoredSubmissionsCount: completedPerSubmission.size,
      fullyEvaluatedCount,
      underEvaluatedCount,
    };

    return {
      overview,
      totalSubmissions,
      eligibleSubmissions,
      totalJudges,
      totalAssignments,
      completedAssignments,
      inProgressAssignments,
      pendingAssignments,
      finalizedScoresCount,
      completionRate,
      submissionsAssignedCount: assignmentsPerSubmission.size,
      judgeWorkload,
      judgeWorkloads: judgeWorkload,
      submissionCoverage,
    };
  }
}

export const judgingRepository = new JudgingRepository();
