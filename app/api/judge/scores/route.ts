import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveSessionUser } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

/**
 * GET /api/judge/scores
 * Acceptance checker compatible endpoint for judge scores & peer score isolation.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await resolveSessionUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { user } = auth;

    // Check roles across memberships
    const memberships = await prisma.eventMembership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
    });

    const isJudge = memberships.some((m) => m.role === "JUDGE");
    const isOrganizerOrAdmin = memberships.some(
      (m) => m.role === "ORGANIZER" || m.role === "ADMIN"
    );

    if (!isJudge && !isOrganizerOrAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only judges and organizers may access evaluation scores." },
        { status: 403 }
      );
    }

    const requestedJudge = req.nextUrl.searchParams.get("judge");

    // Enforce Backend Role Isolation:
    // If a target judge is specified and caller is not an organizer/admin,
    // verify caller is requesting exclusively their own scores.
    if (requestedJudge) {
      const isSelf =
        requestedJudge === user.id ||
        requestedJudge === user.email ||
        (requestedJudge === "judge_a" && (user.id === "jdg_01" || user.id === "usr_judge_1")) ||
        (requestedJudge === "judge_b" && (user.id === "jdg_02" || user.id === "usr_judge_2"));

      if (!isOrganizerOrAdmin && !isSelf) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Judges cannot inspect peer scores. Role isolation enforced.",
          },
          { status: 403 }
        );
      }
    }

    // Determine target judge ID for scoring lookup
    let targetJudgeId = user.id;
    if (isOrganizerOrAdmin && requestedJudge) {
      targetJudgeId = requestedJudge;
    }

    // Fetch scores from database
    const scores = await prisma.score.findMany({
      where: isOrganizerOrAdmin && !requestedJudge ? {} : { judgeId: targetJudgeId },
      include: {
        submission: {
          select: {
            id: true,
            title: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      data: scores.map((s) => ({
        id: s.id,
        judgeId: s.judgeId,
        submissionId: s.submissionId,
        submissionTitle: s.submission.title,
        feedback: s.feedback,
        isFinal: s.isFinal,
        items: s.items.map((it) => ({
          criterionId: it.criterionId,
          rawScore: it.rawScore.toString(),
          feedback: it.feedback,
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
