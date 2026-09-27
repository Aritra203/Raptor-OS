import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { scoringService } from "@/server/services/scoring.service";
import { assignmentService } from "@/server/services/assignment.service";
import { ValidationError } from "@/lib/errors/app-error";

describe("Score Immutability Integration", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";
  const judge1Id = "usr_judge_1";
  const submissionId = "sub_mesh_1";

  it("prevents updating or draft overwriting of an already finalized score", async () => {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: judge1Id,
          submissionId,
        },
      },
    });
    expect(assignment).not.toBeNull();

    // Ensure it is finalized
    const evalContext = await scoringService.getAssignmentEvaluation(judge1Id, assignment!.id);
    const criteria = evalContext.rubricVersion.criteria;

    if (!evalContext.isFinal) {
      await scoringService.finalizeScore(judge1Id, assignment!.id, {
        feedback: "Final score lock test",
        items: criteria.map((c) => ({ criterionId: c.id, rawScore: 8, feedback: null })),
      });
    }

    // Attempt to save a draft over the finalized score
    await expect(
      scoringService.saveScoreDraft(judge1Id, assignment!.id, {
        feedback: "Attempted tampering",
        items: [{ criterionId: criteria[0]!.id, rawScore: 2, feedback: null }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("prevents re-finalizing an already finalized score", async () => {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: judge1Id,
          submissionId,
        },
      },
    });

    const evalContext = await scoringService.getAssignmentEvaluation(judge1Id, assignment!.id);
    const criteria = evalContext.rubricVersion.criteria;

    await expect(
      scoringService.finalizeScore(judge1Id, assignment!.id, {
        feedback: "Attempted second finalization",
        items: criteria.map((c) => ({ criterionId: c.id, rawScore: 10, feedback: null })),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("prevents organizer from revoking a completed assignment with finalized score", async () => {
    const assignment = await prisma.judgeAssignment.findUnique({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: judge1Id,
          submissionId,
        },
      },
    });

    await expect(
      assignmentService.revokeAssignment(organizerId, assignment!.id)
    ).rejects.toThrow(ValidationError);
  });
});
