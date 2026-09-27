import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/server/services/team.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const auth = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    if (!body.email) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invitee email is required." } },
        { status: 400 }
      );
    }

    const result = await teamService.inviteMember(teamId, body.email, auth.user.id);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
