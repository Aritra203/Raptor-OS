import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/server/services/team.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const teams = await teamService.listTeamsInEvent(eventId);
    return NextResponse.json({ data: teams }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const team = await teamService.createTeam(
      {
        eventId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        trackId: body.trackId || null,
      },
      auth.user.id
    );

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
