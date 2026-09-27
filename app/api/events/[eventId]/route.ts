import { NextRequest, NextResponse } from "next/server";
import { eventService } from "@/server/services/event.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const event = await eventService.getEventById(eventId);
    return NextResponse.json({ data: event }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireEventRole(eventId, "ORGANIZER", req);
    const body = await req.json().catch(() => ({}));

    const updated = await eventService.updateEvent(
      eventId,
      {
        name: body.name,
        description: body.description,
        location: body.location,
        isVirtual: body.isVirtual,
        timezone: body.timezone,
        registrationStart: body.registrationStart ? new Date(body.registrationStart) : body.registrationStart === null ? null : undefined,
        registrationEnd: body.registrationEnd ? new Date(body.registrationEnd) : body.registrationEnd === null ? null : undefined,
        submissionsStart: body.submissionsStart ? new Date(body.submissionsStart) : body.submissionsStart === null ? null : undefined,
        submissionsEnd: body.submissionsEnd ? new Date(body.submissionsEnd) : body.submissionsEnd === null ? null : undefined,
        judgingStart: body.judgingStart ? new Date(body.judgingStart) : body.judgingStart === null ? null : undefined,
        judgingEnd: body.judgingEnd ? new Date(body.judgingEnd) : body.judgingEnd === null ? null : undefined,
        startsAt: body.startsAt ? new Date(body.startsAt) : body.startsAt === null ? null : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined,
        minTeamSize: body.minTeamSize ? Number(body.minTeamSize) : undefined,
        maxTeamSize: body.maxTeamSize ? Number(body.maxTeamSize) : undefined,
      },
      auth.user.id
    );

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
