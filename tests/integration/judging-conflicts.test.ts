import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { assignmentService } from "@/server/services/assignment.service";
import { scoringService } from "@/server/services/scoring.service";
import { ForbiddenError } from "@/lib/errors/app-error";

describe("Judging Conflict of Interest Prevention", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";
  const participant1Id = "usr_part_1"; // Member of team1 (sub_mesh_1)
  const submissionId = "sub_mesh_1";

  it("prevents assigning a judge who is a member of the submitted team", async () => {
    // Temporarily make usr_part_1 a judge in evt_raptor_2026
    const membership = await prisma.eventMembership.findFirst({
      where: { userId: participant1Id, eventId, role: "PARTICIPANT" },
    });
    if (membership) {
      await prisma.eventMembership.update({
        where: { id: membership.id },
        data: { role: "JUDGE" },
      });
    }

    try {
      // Run assignment generation
      const report = await assignmentService.generateAssignments(organizerId, eventId, {
        targetJudgesPerSubmission: 3,
      });
      expect(report.batchId).toBeDefined();

      // Verify participant1 was NOT assigned to their own submission (sub_mesh_1)
      const conflictAssignment = await prisma.judgeAssignment.findUnique({
        where: {
          eventId_judgeId_submissionId: {
            eventId,
            judgeId: participant1Id,
            submissionId,
          },
        },
      });

      expect(conflictAssignment).toBeNull();
    } finally {
      // Revert role
      if (membership) {
        await prisma.eventMembership.update({
          where: { id: membership.id },
          data: { role: "PARTICIPANT" },
        });
      }
    }
  });

  it("independently halts evaluation attempt if judge is a team member", async () => {
    // Manually force-insert a conflicting assignment to test defensive multi-layer protection
    const forcedAssignment = await prisma.judgeAssignment.upsert({
      where: {
        eventId_judgeId_submissionId: {
          eventId,
          judgeId: participant1Id,
          submissionId,
        },
      },
      update: { status: "PENDING" },
      create: {
        eventId,
        judgeId: participant1Id,
        submissionId,
        status: "PENDING",
      },
    });

    try {
      // Evaluation must be rejected by scoringService defense
      await expect(
        scoringService.getAssignmentEvaluation(participant1Id, forcedAssignment.id)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        scoringService.saveScoreDraft(participant1Id, forcedAssignment.id, {
          feedback: "Conflict draft",
          items: [],
        })
      ).rejects.toThrow(ForbiddenError);
    } finally {
      // Clean up forced assignment
      await prisma.judgeAssignment.delete({
        where: { id: forcedAssignment.id },
      });
    }
  });
});
