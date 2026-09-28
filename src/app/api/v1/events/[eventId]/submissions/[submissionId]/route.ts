import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { eventRepository } from "@/server/repositories/event.repository";
import { resolveSessionUser } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";
import { NotFoundError, ForbiddenError } from "@/lib/errors/app-error";
import { toSubmissionDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/events/[eventId]/submissions/[submissionId]
 * Retrieves details of a specific submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; submissionId: string }> }
) {
  try {
    const { eventId, submissionId } = await params;
    const event = await eventRepository.findEventBySlugOrId(eventId);
    if (!event) {
      throw new NotFoundError("Event", eventId);
    }

    const submission = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        eventId: event.id,
      },
      include: {
        team: { select: { name: true } },
        track: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    });

    if (!submission) {
      throw new NotFoundError("Submission", submissionId);
    }

    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === event.id && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    // Non-organizers cannot view drafts or disqualified projects unless they are on that team
    if (submission.state === "DRAFT" || submission.state === "DISQUALIFIED") {
      const isTeamMember = auth?.user.id
        ? await prisma.teamMember.findFirst({
            where: { teamId: submission.teamId, userId: auth.user.id },
          })
        : null;

      if (!isOrganizer && !isTeamMember) {
        throw new ForbiddenError("Access to this submission is restricted.");
      }
    }

    // Check if community vote counts can be revealed
    const votingConfig = await prisma.votingConfig.findUnique({
      where: { eventId: event.id },
    });
    const canShowVoteCounts =
      isOrganizer ||
      (votingConfig?.publicVoteCounts && votingConfig?.resultsPublished);

    return apiSuccess(toSubmissionDTO(submission, canShowVoteCounts));
  } catch (error) {
    return apiError(error);
  }
}
