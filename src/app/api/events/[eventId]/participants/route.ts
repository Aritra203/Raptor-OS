import { NextRequest, NextResponse } from "next/server";
import { registrationService } from "@/server/services/registration.service";
import { requireEventRole } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    await requireEventRole(eventId, "ORGANIZER", req);
    const participants = await registrationService.listParticipants(eventId);
    return NextResponse.json({ data: participants }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
