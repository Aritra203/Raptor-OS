import { NextRequest, NextResponse } from "next/server";
import { eventService } from "@/server/services/event.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);
    const body = await req.json().catch(() => ({}));

    const prize = await eventService.createPrize(
      {
        eventId,
        trackId: body.trackId || null,
        name: body.name,
        description: body.description,
        value: body.value !== undefined && body.value !== null ? Number(body.value) : null,
        order: body.order ? Number(body.order) : undefined,
      },
      auth.user.id
    );

    return NextResponse.json({ data: prize }, { status: 201 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
