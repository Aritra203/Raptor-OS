import { NextRequest, NextResponse } from "next/server";
import { eventService } from "@/server/services/event.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";
import type { EventState } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);
    const body = await req.json().catch(() => ({}));

    if (!body.state) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Target state is required." } },
        { status: 400 }
      );
    }

    const updated = await eventService.transitionEvent(
      eventId,
      body.state as EventState,
      auth.user.id
    );

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
