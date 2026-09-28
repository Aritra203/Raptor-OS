import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAnyEventRole } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/judging/assignments
 * Retrieves judging assignments for the caller (or all assignments if organizer/admin).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { user, membership } = await requireAnyEventRole(
      eventId,
      ["JUDGE", "ORGANIZER", "ADMIN"],
      req
    );

    const isOrganizer =
      membership.role === "ORGANIZER" || membership.role === "ADMIN";

    const where = {
      eventId,
      ...(isOrganizer ? {} : { judgeId: user.id }),
    };

    const assignments = await prisma.judgeAssignment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        submission: {
          select: {
            id: true,
            title: true,
            team: { select: { name: true } },
            track: { select: { name: true } },
          },
        },
        judge: {
          select: { id: true, name: true },
        },
      },
    });

    const submissionIds = assignments.map((a) => a.submissionId);
    const scores = await prisma.score.findMany({
      where: {
        eventId,
        submissionId: { in: submissionIds },
        ...(isOrganizer ? {} : { judgeId: user.id }),
      },
      select: {
        id: true,
        judgeId: true,
        submissionId: true,
        isFinal: true,
      },
    });

    const scoreMap = new Map<string, { id: string; isFinal: boolean }>();
    for (const sc of scores) {
      scoreMap.set(`${sc.judgeId}_${sc.submissionId}`, { id: sc.id, isFinal: sc.isFinal });
    }

    const sanitized = assignments.map((a) => {
      const score = scoreMap.get(`${a.judgeId}_${a.submissionId}`) || null;
      return {
        id: a.id,
        submissionId: a.submissionId,
        submissionTitle: a.submission.title,
        teamName: a.submission.team.name,
        trackName: a.submission.track?.name || null,
        status: a.status,
        isScored: score !== null,
        isFinal: score?.isFinal || false,
        ...(isOrganizer ? { judge: { id: a.judge.id, name: a.judge.name } } : {}),
      };
    });

    return apiSuccess(sanitized);
  } catch (error) {
    return apiError(error);
  }
}
