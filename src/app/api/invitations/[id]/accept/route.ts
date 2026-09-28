import { NextRequest, NextResponse } from "next/server";
import { teamService } from "@/server/services/team.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireUser(req);
    const member = await teamService.acceptInvitation(id, auth.user.id, auth.user.email);
    return NextResponse.json({ data: member }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
