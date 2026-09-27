import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { rubricService } from "@/server/services/rubric.service";
import { assignmentService } from "@/server/services/assignment.service";
import { scoringService } from "@/server/services/scoring.service";
import { ForbiddenError, ValidationError } from "@/lib/errors/app-error";

describe("Judging Authorization & Lifecycle Guards", () => {
  const eventId = "evt_raptor_2026";
  const participantId = "usr_part_2";
  const judge1Id = "usr_judge_1";
  const judge2Id = "usr_judge_2";
  const submissionId = "sub_mesh_1";

  it("prevents non-organizers from creating rubrics", async () => {
    await expect(
      rubricService.createRubric(participantId, eventId, {
        name: "Unauthorized Rubric",
        description: null,
        criteria: [{ name: "Test", weight: 100, maxScore: 10, description: null, order: 0 }],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("prevents non-organizers from generating assignments", async () => {
    await expect(
      assignmentService.generateAssignments(participantId, eventId, {
        targetJudgesPerSubmission: 2,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("prevents a judge from evaluating another judge's assigned submission", async () => {
    // Find assignment belonging specifically to judge1
    const assignment1 = await prisma.judgeAssignment.findUnique({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: judge1Id,
          submissionId,
        },
      },
    });
    expect(assignment1).not.toBeNull();

    // Judge 2 attempts to score Judge 1's assignment
    await expect(
      scoringService.getAssignmentEvaluation(judge2Id, assignment1!.id)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      scoringService.saveScoreDraft(judge2Id, assignment1!.id, {
        feedback: "Impersonation attempt",
        items: [],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("prohibits scoring if the event is not in JUDGING_OPEN state", async () => {
    // Change event state to SUBMISSIONS_CLOSED temporarily
    await prisma.event.update({
      where: { id: eventId },
      data: { state: "SUBMISSIONS_CLOSED" },
    });

    const assignment = await prisma.judgeAssignment.findUnique({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: judge1Id,
          submissionId,
        },
      },
    });

    try {
      await expect(
        scoringService.getAssignmentEvaluation(judge1Id, assignment!.id)
      ).rejects.toThrow(ValidationError);
    } finally {
      // Revert event state back to JUDGING_OPEN
      await prisma.event.update({
        where: { id: eventId },
        data: { state: "JUDGING_OPEN" },
      });
    }
  });
});
