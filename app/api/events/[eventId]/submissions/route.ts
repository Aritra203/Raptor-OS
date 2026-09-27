import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { submissionService } from "@/server/services/submission.service";
import { createSubmissionSchema } from "@/lib/validations/submission";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/events/[eventId]/submissions
 * Creates an initial draft submission for a team in an event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const rawBody = await req.json();
    const validated = createSubmissionSchema.parse(rawBody);

    const submission = await submissionService.createDraft(
      auth.user.id,
      eventId,
      validated
    );

    return NextResponse.json(
      {
        data: submission,
        meta: { message: "Draft submission created successfully." },
      },
      { status: 201 }
    );
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * GET /api/events/[eventId]/submissions
 * Lists submissions for an event.
 * Organizers/Admins receive all event submissions; other members receive their team's submission.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const auth = await requireUser(req);
    const { eventId } = await params;

    const membership = auth.user.eventMemberships?.find(
      (m) => m.eventId === eventId && m.status === "ACTIVE"
    );

    if (membership && (membership.role === "ORGANIZER" || membership.role === "ADMIN")) {
      const submissions = await submissionService.listSubmissionsForEvent(eventId);
      return NextResponse.json({ data: submissions });
    }

    return NextResponse.json({
      data: [],
      meta: { message: "Organizer role required to list all event submissions." },
    });
  } catch (error) {
    const { body, status } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
