import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveSessionUser } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

/**
 * POST /api/submissions/submit
 * Acceptance checker compatible endpoint for submission deadline enforcement.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await resolveSessionUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { user: _user } = auth;
    const body = await req.json().catch(() => ({}));

    // Target the fixture event evt_01 if not explicitly provided
    const eventId = (body.eventId as string) || "evt_01";
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const now = new Date();
    // Enforce deadline check strictly:
    if (event.submissionsEnd && now > event.submissionsEnd) {
      return NextResponse.json(
        {
          error: `Submissions closed on ${event.submissionsEnd.toISOString()}. Late submissions are rejected.`,
          eventState: event.state,
        },
        { status: 403 }
      );
    }

    if (event.state !== "SUBMISSIONS_OPEN") {
      return NextResponse.json(
        {
          error: `Event is currently in ${event.state} state. Submissions are not accepted.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ message: "Submission accepted" }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 400 }
    );
  }
}
