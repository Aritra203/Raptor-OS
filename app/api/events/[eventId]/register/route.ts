import { NextRequest, NextResponse } from "next/server";
import { registrationService } from "@/server/services/registration.service";
import { requireUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireUser(req);
    const membership = await registrationService.getRegistration(auth.user.id, eventId);
    return NextResponse.json({ data: membership }, { status: 200 });
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
    const membership = await registrationService.registerForEvent(auth.user.id, eventId);
    return NextResponse.json({ data: membership }, { status: 201 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const auth = await requireUser(req);
    const result = await registrationService.cancelRegistration(auth.user.id, eventId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
