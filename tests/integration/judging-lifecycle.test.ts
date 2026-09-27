import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { rubricService } from "@/server/services/rubric.service";
import { assignmentService } from "@/server/services/assignment.service";
import { scoringService } from "@/server/services/scoring.service";
import { judgingService } from "@/server/services/judging.service";

describe("Judging Lifecycle Integration", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";
  const judge1Id = "usr_judge_1";
  const submissionId = "sub_mesh_1";

  it("organizer can create a new rubric with valid criteria weights", async () => {
    const rubric = await rubricService.createRubric(organizerId, eventId, {
      name: "Integration Test Rubric",
      description: "Rubric for integration testing",
      criteria: [
        { name: "Code Architecture", weight: 50, maxScore: 10, order: 0, description: null },
        { name: "Usability", weight: 50, maxScore: 10, order: 1, description: null },
      ],
    });

    expect(rubric.id).toBeDefined();
    expect(rubric.name).toBe("Integration Test Rubric");
    expect(rubric.versions).toHaveLength(1);
    expect(rubric.versions[0]?.criteria).toHaveLength(2);
  });

  it("organizer can generate deterministic balanced judge assignments", async () => {
    const report = await assignmentService.generateAssignments(organizerId, eventId, {
      targetJudgesPerSubmission: 2,
    });

    expect(report.batchId).toBeDefined();
    expect(report.totalSubmissions).toBeGreaterThan(0);
    expect(report.totalJudges).toBeGreaterThanOrEqual(2);
    expect(report.judgeWorkloadStats.min).toBeGreaterThanOrEqual(0);
  });

  it("judge can save a draft score with partial criteria", async () => {
    // Find or ensure assignment for judge1 on submission1
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

    // Reset status to PENDING and remove any existing final score for this test
    await prisma.score.deleteMany({
      where: { judgeId: judge1Id, submissionId },
    });
    await prisma.judgeAssignment.update({
      where: { id: assignment!.id },
      data: { status: "PENDING" },
    });

    // Fetch evaluation context
    const evalContext = await scoringService.getAssignmentEvaluation(judge1Id, assignment!.id);
    expect(evalContext.rubricVersion).toBeDefined();

    const firstCrit = evalContext.rubricVersion.criteria[0];
    expect(firstCrit).toBeDefined();

    // Save partial draft (only 1 criterion)
    const draft = await scoringService.saveScoreDraft(judge1Id, assignment!.id, {
      feedback: "Draft feedback: solid start",
      items: [{ criterionId: firstCrit!.id, rawScore: 8, feedback: null }],
    });

    expect(draft).not.toBeNull();
    expect(draft!.isFinal).toBe(false);
    expect(draft!.feedback).toBe("Draft feedback: solid start");

    // Check assignment status changed to IN_PROGRESS
    const updatedAssignment = await prisma.judgeAssignment.findUnique({
      where: { id: assignment!.id },
    });
    expect(updatedAssignment!.status).toBe("IN_PROGRESS");
  });

  it("judge can finalize evaluation, calculating high-precision weighted score and locking it", async () => {
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

    // Finalize with all criteria scored
    const finalResult = await scoringService.finalizeScore(judge1Id, assignment!.id, {
      feedback: "Official review completed. Outstanding project.",
      items: criteria.map((c) => ({
        criterionId: c.id,
        rawScore: 9,
        feedback: "High quality",
      })),
    });

    expect(finalResult.isFinal).toBe(true);
    expect(finalResult.calculation.weightedScore.toNumber()).toBeGreaterThan(0);

    // Verify assignment is marked COMPLETED
    const updatedAssignment = await prisma.judgeAssignment.findUnique({
      where: { id: assignment!.id },
    });
    expect(updatedAssignment!.status).toBe("COMPLETED");
    expect(updatedAssignment!.completedAt).not.toBeNull();
  });

  it("organizer real-time progress metrics reflect the finalized evaluation", async () => {
    const progress = await judgingService.getEventJudgingProgress(organizerId, eventId);

    expect(progress.overview.totalAssignments).toBeGreaterThan(0);
    expect(progress.overview.completedAssignments).toBeGreaterThanOrEqual(1);
    expect(progress.judgeWorkload.length).toBeGreaterThan(0);

    const judge1Stats = progress.judgeWorkload.find((j: { judgeId: string }) => j.judgeId === judge1Id);
    expect(judge1Stats).toBeDefined();
    expect(judge1Stats!.completed).toBeGreaterThanOrEqual(1);
  });
});
