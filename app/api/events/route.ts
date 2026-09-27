import { NextRequest, NextResponse } from "next/server";
import { eventService } from "@/server/services/event.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET() {
  try {
    const events = await eventService.getPublicEvents();
    return NextResponse.json({ data: events }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const event = await eventService.createEvent(
      {
        name: body.name,
        slug: body.slug,
        description: body.description,
        location: body.location,
        isVirtual: body.isVirtual,
        timezone: body.timezone,
        registrationStart: body.registrationStart ? new Date(body.registrationStart) : null,
        registrationEnd: body.registrationEnd ? new Date(body.registrationEnd) : null,
        submissionsStart: body.submissionsStart ? new Date(body.submissionsStart) : null,
        submissionsEnd: body.submissionsEnd ? new Date(body.submissionsEnd) : null,
        judgingStart: body.judgingStart ? new Date(body.judgingStart) : null,
        judgingEnd: body.judgingEnd ? new Date(body.judgingEnd) : null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        minTeamSize: body.minTeamSize ? Number(body.minTeamSize) : undefined,
        maxTeamSize: body.maxTeamSize ? Number(body.maxTeamSize) : undefined,
      },
      auth.user.id
    );

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
