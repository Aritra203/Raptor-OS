import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/server/services/team.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  try {
    const { teamId, userId } = await params;
    const auth = await requireUser(req);
    const result = await teamService.removeMember(teamId, userId, auth.user.id);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
