import {
  judgingRepository,
  type JudgeAssignmentWithDetails,
  type ScoreWithDetails,
} from "@/server/repositories/judging.repository";
import { rubricRepository } from "@/server/repositories/rubric.repository";
import { calculateWeightedScore } from "@/lib/utils/scoring";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/errors/app-error";
import type { SaveScoreDraftInput, FinalizeScoreInput } from "@/lib/validations/judging";

export class ScoringService {
  /**
   * Validates that the event is currently in the JUDGING_OPEN lifecycle state.
   */
  private validateJudgingState(event: { state: string; name: string }) {
    if (event.state !== "JUDGING_OPEN") {
      throw new ValidationError(
        `Scoring is only permitted while the event is in 'JUDGING_OPEN' state. Current state: '${event.state}'.`
      );
    }
  }

  /**
   * Independent server-side conflict detection to prevent self-judging.
   */
  private verifyNoConflict(
    judgeId: string,
    team: { creatorId?: string; members: Array<{ userId: string }> }
  ) {
    if (team.creatorId === judgeId || team.members.some((m) => m.userId === judgeId)) {
      throw new ForbiddenError(
        "Self-judging violation: You cannot score your own team or project."
      );
    }
  }

  /**
   * Validates and retrieves the assignment for a scoring action.
   */
  private async getValidAssignment(
    userId: string,
    assignmentId: string
  ): Promise<JudgeAssignmentWithDetails> {
    const assignment = await judgingRepository.findAssignmentById(assignmentId);
    if (!assignment) {
      throw new NotFoundError(`Judge assignment with ID '${assignmentId}' was not found.`);
    }

    // Must be the assigned judge
    if (assignment.judgeId !== userId) {
      throw new ForbiddenError("You are not authorized to score this assignment. Only the assigned judge may submit evaluations.");
    }

    // Must not be excused/revoked
    if (assignment.status === "EXCUSED") {
      throw new ValidationError("This assignment has been excused/revoked by event organizers and cannot be scored.");
    }

    // Event must be in JUDGING_OPEN
    this.validateJudgingState(assignment.event);

    // Submission must be eligible
    if (assignment.submission.state !== "SUBMITTED" && assignment.submission.state !== "LOCKED") {
      throw new ValidationError(
        `Cannot score submission in '${assignment.submission.state}' state. Submissions must be 'SUBMITTED' or 'LOCKED'.`
      );
    }

    // Independent conflict check
    this.verifyNoConflict(userId, assignment.submission.team);

    return assignment;
  }

  /**
   * Retrieves score and rubric details for an assignment.
   */
  async getAssignmentEvaluation(userId: string, assignmentId: string) {
    const assignment = await this.getValidAssignment(userId, assignmentId);

    // Find active rubric version for this event & track
    const rubricVersion = await rubricRepository.findActiveRubricVersionForEvent(
      assignment.eventId,
      assignment.submission.track?.id
    );

    if (!rubricVersion) {
      throw new ValidationError(
        "No active judging rubric is configured for this hackathon. Contact event organizers."
      );
    }

    // Find existing score draft or final score
    const existingScore = await judgingRepository.findScore(
      userId,
      assignment.submissionId,
      rubricVersion.id
    );

    return {
      assignment,
      rubricVersion,
      score: existingScore,
      isFinal: existingScore?.isFinal ?? false,
    };
  }

  /**
   * Saves or updates a draft score evaluation.
   */
  async saveScoreDraft(
    userId: string,
    assignmentId: string,
    input: SaveScoreDraftInput
  ) {
    const assignment = await this.getValidAssignment(userId, assignmentId);

    const rubricVersion = await rubricRepository.findActiveRubricVersionForEvent(
      assignment.eventId,
      assignment.submission.track?.id
    );
    if (!rubricVersion) {
      throw new ValidationError("No active judging rubric found for this event.");
    }

    // Check if score is already finalized (IMMUTABLE!)
    const existingScore = await judgingRepository.findScore(
      userId,
      assignment.submissionId,
      rubricVersion.id
    );
    if (existingScore?.isFinal) {
      throw new ValidationError(
        "This score has already been finalized. Finalized scores are immutable historical evidence and cannot be updated."
      );
    }

    // Validate score ranges for provided items
    const criteriaMap = new Map(rubricVersion.criteria.map((c) => [c.id, c]));

    for (const item of input.items) {
      const criterion = criteriaMap.get(item.criterionId);
      if (!criterion) {
        throw new ValidationError(`Invalid criterion ID '${item.criterionId}' for this rubric.`);
      }
      const raw = Number(item.rawScore);
      const max = Number(criterion.maxScore);
      if (raw < 0 || raw > max) {
        throw new ValidationError(
          `Score for '${criterion.name}' must be between 0 and ${max}. Received: ${raw}.`
        );
      }
    }

    await judgingRepository.saveScoreDraft({
      eventId: assignment.eventId,
      judgeId: userId,
      submissionId: assignment.submissionId,
      rubricVersionId: rubricVersion.id,
      assignmentId,
      feedback: input.feedback,
      items: input.items,
    });

    return judgingRepository.findScore(userId, assignment.submissionId, rubricVersion.id);
  }

  /**
   * Finalizes score evaluation.
   * Enforces that ALL required criteria are scored, calculates weighted aggregate,
   * marks assignment COMPLETED, and locks the score as IMMUTABLE historical evidence.
   */
  async finalizeScore(
    userId: string,
    assignmentId: string,
    input: FinalizeScoreInput
  ): Promise<ScoreWithDetails & { calculation: ReturnType<typeof calculateWeightedScore> }> {
    const assignment = await this.getValidAssignment(userId, assignmentId);

    const rubricVersion = await rubricRepository.findActiveRubricVersionForEvent(
      assignment.eventId,
      assignment.submission.track?.id
    );
    if (!rubricVersion) {
      throw new ValidationError("No active judging rubric found for this event.");
    }

    // Check if score is already finalized
    const existingScore = await judgingRepository.findScore(
      userId,
      assignment.submissionId,
      rubricVersion.id
    );
    if (existingScore?.isFinal) {
      throw new ValidationError(
        "This score has already been finalized. Finalized scores are immutable and cannot be resubmitted."
      );
    }

    // Verify EVERY criterion in the active rubric is scored
    const submittedItemMap = new Map(input.items.map((it) => [it.criterionId, it]));

    for (const criterion of rubricVersion.criteria) {
      const item = submittedItemMap.get(criterion.id);
      if (!item) {
        throw new ValidationError(
          `Missing required score for criterion '${criterion.name}'. All rubric criteria must be evaluated to finalize.`
        );
      }
      const raw = Number(item.rawScore);
      const max = Number(criterion.maxScore);
      if (raw < 0 || raw > max) {
        throw new ValidationError(
          `Score for '${criterion.name}' must be between 0 and ${max}. Received: ${raw}.`
        );
      }
    }

    // Calculate weighted aggregate score
    const calculation = calculateWeightedScore(
      rubricVersion.criteria.map((c) => ({
        rawScore: submittedItemMap.get(c.id)!.rawScore,
        maxScore: c.maxScore,
        weight: c.weight,
      }))
    );

    // Atomically finalize score and complete assignment
    const finalizedScore = await judgingRepository.finalizeScore(
      {
        eventId: assignment.eventId,
        judgeId: userId,
        submissionId: assignment.submissionId,
        rubricVersionId: rubricVersion.id,
        assignmentId,
        feedback: input.feedback,
        items: input.items,
      },
      userId
    );

    return {
      ...finalizedScore,
      calculation,
    };
  }

  /**
   * Retrieves a judge's assignments list.
   */
  async getJudgeAssignments(userId: string, eventId?: string) {
    return judgingRepository.findJudgeAssignments(userId, eventId);
  }
}

export const scoringService = new ScoringService();
