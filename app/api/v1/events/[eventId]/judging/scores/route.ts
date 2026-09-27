import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { scoringService } from "@/server/services/scoring.service";
import { requireAnyEventRole } from "@/server/auth/authorization";
import { finalizeScoreSchema, saveScoreDraftSchema } from "@/lib/validations/judging";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/judging/scores
 * Retrieves evaluation scores (caller's scores for judges, all scores for organizers).
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

    const scores = await prisma.score.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        submission: { select: { id: true, title: true } },
        items: {
          select: {
            criterionId: true,
            rawScore: true,
            feedback: true,
          },
        },
      },
    });

    const sanitized = scores.map((s) => ({
      id: s.id,
      submissionId: s.submissionId,
      submissionTitle: s.submission.title,
      feedback: s.feedback,
      isFinal: s.isFinal,
      createdAt: s.createdAt.toISOString(),
      scoreItems: s.items.map((item) => ({
        criterionId: item.criterionId,
        rawScore: item.rawScore.toString(),
        feedback: item.feedback,
      })),
    }));

    return apiSuccess(sanitized);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/events/[eventId]/judging/scores
 * Submits or finalizes an evaluation score for an assignment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { user } = await requireAnyEventRole(eventId, ["JUDGE"], req);

    const body = await req.json();
    const assignmentId = body.assignmentId;
    if (!assignmentId) {
      throw new Error("Missing required field 'assignmentId' in request body.");
    }

    const isFinal = Boolean(body.isFinal);

    let result;
    if (isFinal) {
      const validated = finalizeScoreSchema.parse(body);
      result = await scoringService.finalizeScore(user.id, assignmentId, validated);
    } else {
      const validated = saveScoreDraftSchema.parse(body);
      result = await scoringService.saveScoreDraft(user.id, assignmentId, validated);
    }

    return apiSuccess(
      {
        id: result?.id,
        isFinal: result?.isFinal,
        feedback: result?.feedback,
      },
      201
    );
  } catch (error) {
    return apiError(error);
  }
}
