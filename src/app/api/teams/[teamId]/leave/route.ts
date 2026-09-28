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
    const result = await teamService.leaveTeam(teamId, auth.user.id);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
