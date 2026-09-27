import {
  judgingRepository,
  type JudgeAssignmentWithDetails,
} from "@/server/repositories/judging.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { prisma } from "@/lib/db/prisma";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import type { GenerateAssignmentsInput } from "@/lib/validations/judging";

export interface AssignmentGenerationReport {
  batchId: string;
  algorithm: string;
  targetCoverage: number;
  totalSubmissions: number;
  totalJudges: number;
  totalAssignmentsCreated: number;
  fullyAssignedCount: number;
  underAssignedCount: number;
  underAssignedDetails: Array<{ submissionId: string; title: string; assignedCount: number }>;
  judgeWorkloadStats: {
    min: number;
    max: number;
    average: number;
    distribution: Array<{ judgeId: string; judgeName: string; count: number }>;
  };
}

export class AssignmentService {
  /**
   * Verifies user has ORGANIZER or ADMIN role in the event.
   */
  private async verifyOrganizerRole(userId: string, eventId: string) {
    const membership = await eventRepository.findMembership(userId, eventId);
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      (membership.role !== "ORGANIZER" && membership.role !== "ADMIN")
    ) {
      throw new ForbiddenError("Only event organizers or administrators can manage judge assignments.");
    }
    return membership;
  }

  /**
   * Generates deterministic, balanced judge assignments for all eligible submissions.
   * Enforces self-judging prevention, duplicate rejection, and workload balancing.
   */
  async generateAssignments(
    userId: string,
    eventId: string,
    input: GenerateAssignmentsInput
  ): Promise<AssignmentGenerationReport> {
    await this.verifyOrganizerRole(userId, eventId);

    const event = await eventRepository.findEventById(eventId);
    if (!event) {
      throw new NotFoundError(`Event with ID '${eventId}' was not found.`);
    }

    const targetCoverage = input.targetJudgesPerSubmission || 2;

    // 1. Fetch eligible submissions (SUBMITTED or LOCKED, not disqualified, with versions)
    const submissions = await prisma.submission.findMany({
      where: {
        eventId,
        state: { in: ["SUBMITTED", "LOCKED"] },
        ...(input.trackId ? { trackId: input.trackId } : {}),
      },
      include: {
        team: {
          include: {
            members: { select: { userId: true, role: true } },
          },
        },
        versions: { take: 1 },
      },
      orderBy: { id: "asc" }, // Deterministic order
    });

    if (submissions.length === 0) {
      throw new ValidationError("No eligible (SUBMITTED or LOCKED) project submissions found for assignment.");
    }

    // 2. Fetch eligible active judges in the event
    const judgeMemberships = await prisma.eventMembership.findMany({
      where: {
        eventId,
        role: "JUDGE",
        status: "ACTIVE",
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { userId: "asc" }, // Deterministic order
    });

    if (judgeMemberships.length === 0) {
      throw new ValidationError("No active judges registered for this event. Add judges before generating assignments.");
    }

    if (judgeMemberships.length < targetCoverage) {
      throw new ValidationError(
        `Insufficient judges: The event has ${judgeMemberships.length} active judges, but the requested coverage is ${targetCoverage} judges per project.`
      );
    }

    // 3. Pre-fetch existing active assignments to prevent duplicate pairs
    const existingAssignments = await prisma.judgeAssignment.findMany({
      where: {
        eventId,
        status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
      },
      select: { judgeId: true, submissionId: true },
    });

    const assignedPairSet = new Set<string>();
    const workloadMap = new Map<string, number>();

    // Initialize workload counter for all judges
    for (const jm of judgeMemberships) {
      workloadMap.set(jm.userId, 0);
    }

    for (const ea of existingAssignments) {
      assignedPairSet.add(`${ea.judgeId}_${ea.submissionId}`);
      if (workloadMap.has(ea.judgeId)) {
        workloadMap.set(ea.judgeId, (workloadMap.get(ea.judgeId) || 0) + 1);
      }
    }

    // 4. Run Deterministic Balanced Assignment Algorithm
    const newAssignments: Array<{ eventId: string; judgeId: string; submissionId: string }> = [];
    const underAssignedDetails: Array<{ submissionId: string; title: string; assignedCount: number }> = [];

    for (const sub of submissions) {
      // Determine conflicts for this submission (team creator + members)
      const conflictUserIds = new Set<string>();
      conflictUserIds.add(sub.team.creatorId);
      for (const m of sub.team.members) {
        conflictUserIds.add(m.userId);
      }

      // Filter judges who have NO conflict and are NOT already assigned to this submission
      const candidateJudges = judgeMemberships.filter((jm) => {
        const isConflict = conflictUserIds.has(jm.userId);
        const alreadyAssigned = assignedPairSet.has(`${jm.userId}_${sub.id}`);
        return !isConflict && !alreadyAssigned;
      });

      // Count how many judges this submission already has
      let currentAssignedCount = judgeMemberships.filter((jm) =>
        assignedPairSet.has(`${jm.userId}_${sub.id}`)
      ).length;

      const neededCount = Math.max(0, targetCoverage - currentAssignedCount);

      if (neededCount > 0) {
        // Sort candidates: least workload first, then deterministic userId comparison
        candidateJudges.sort((a, b) => {
          const loadA = workloadMap.get(a.userId) || 0;
          const loadB = workloadMap.get(b.userId) || 0;
          if (loadA !== loadB) {
            return loadA - loadB;
          }
          return a.userId.localeCompare(b.userId);
        });

        const selected = candidateJudges.slice(0, neededCount);

        for (const j of selected) {
          newAssignments.push({
            eventId,
            judgeId: j.userId,
            submissionId: sub.id,
          });
          assignedPairSet.add(`${j.userId}_${sub.id}`);
          workloadMap.set(j.userId, (workloadMap.get(j.userId) || 0) + 1);
          currentAssignedCount += 1;
        }
      }

      if (currentAssignedCount < targetCoverage) {
        underAssignedDetails.push({
          submissionId: sub.id,
          title: sub.title,
          assignedCount: currentAssignedCount,
        });
      }
    }

    // 5. Persist batch and generated assignments atomically
    const batch = await judgingRepository.createAssignmentBatch({
      eventId,
      createdById: userId,
      algorithm: "DETERMINISTIC_BALANCED_V1",
      targetCoverage,
      submissionCount: submissions.length,
      judgeCount: judgeMemberships.length,
      assignmentCount: newAssignments.length,
      parameters: {
        trackId: input.trackId || null,
        targetCoverage,
      },
      assignments: newAssignments,
    });

    // 6. Compute statistics
    const workloads = Array.from(workloadMap.values());
    const minLoad = workloads.length > 0 ? Math.min(...workloads) : 0;
    const maxLoad = workloads.length > 0 ? Math.max(...workloads) : 0;
    const totalLoad = workloads.reduce((sum, w) => sum + w, 0);
    const avgLoad = workloads.length > 0 ? Number((totalLoad / workloads.length).toFixed(2)) : 0;

    const distribution = judgeMemberships.map((jm) => ({
      judgeId: jm.userId,
      judgeName: jm.user.name,
      count: workloadMap.get(jm.userId) || 0,
    }));

    return {
      batchId: batch.id,
      algorithm: batch.algorithm,
      targetCoverage,
      totalSubmissions: submissions.length,
      totalJudges: judgeMemberships.length,
      totalAssignmentsCreated: newAssignments.length,
      fullyAssignedCount: submissions.length - underAssignedDetails.length,
      underAssignedCount: underAssignedDetails.length,
      underAssignedDetails,
      judgeWorkloadStats: {
        min: minLoad,
        max: maxLoad,
        average: avgLoad,
        distribution,
      },
    };
  }

  /**
   * Revokes an existing assignment (organizer action).
   */
  async revokeAssignment(userId: string, assignmentId: string) {
    const assignment = await judgingRepository.findAssignmentById(assignmentId);
    if (!assignment) {
      throw new NotFoundError(`Assignment with ID '${assignmentId}' was not found.`);
    }

    await this.verifyOrganizerRole(userId, assignment.eventId);

    if (assignment.status === "COMPLETED") {
      throw new ValidationError("Cannot revoke an assignment that has already been completed with a finalized score.");
    }

    return judgingRepository.revokeAssignment(assignmentId, userId, assignment.eventId);
  }

  /**
   * Lists assignments for an event with workload breakdowns.
   */
  async listEventAssignments(
    userId: string,
    eventId: string,
    filters?: { submissionId?: string; judgeId?: string }
  ): Promise<JudgeAssignmentWithDetails[]> {
    await this.verifyOrganizerRole(userId, eventId);
    return judgingRepository.findEventAssignments(eventId, filters);
  }

  /**
   * Lists assignment batches for an event.
   */
  async listAssignmentBatches(userId: string, eventId: string) {
    await this.verifyOrganizerRole(userId, eventId);
    return judgingRepository.findAssignmentBatchesByEvent(eventId);
  }
}

export const assignmentService = new AssignmentService();
