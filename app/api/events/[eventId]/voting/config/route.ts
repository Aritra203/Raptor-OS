import { NextRequest, NextResponse } from "next/server";
import { communityService } from "@/server/services/community.service";
import {
  requireEventRole,
  resolveSessionUser,
} from "@/server/auth/authorization";
import { updateVotingConfigSchema } from "@/lib/validations/community";
import { verifyRequestOrigin } from "@/lib/utils/csrf";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/voting/config
 * Retrieves community voting configuration for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const config = await communityService.getVotingConfig(eventId);
    const auth = await resolveSessionUser(req);
    const membership = auth?.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );
    const isOrganizer =
      membership?.role === "ORGANIZER" || membership?.role === "ADMIN";

    if (isOrganizer) {
      return NextResponse.json({ config });
    }

    // Public sanitized config
    return NextResponse.json({
      config: {
        isEnabled: config.isEnabled,
        votingStart: config.votingStart,
        votingEnd: config.votingEnd,
        publicVoteCounts: config.publicVoteCounts,
        resultsPublished: config.resultsPublished,
        allowSelfVoting: config.allowSelfVoting,
        randomizeGalleryOrder: config.randomizeGalleryOrder,
      },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * PUT /api/events/[eventId]/voting/config
 * Updates community voting configuration. (Organizer/Admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    verifyRequestOrigin(req);
    const { eventId } = await params;
    const { user } = await requireEventRole(eventId, "ORGANIZER", req);

    const body = await req.json();
    const validated = updateVotingConfigSchema.parse(body);

    const updated = await communityService.updateVotingConfig(
      eventId,
      user.id,
      validated
    );

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
