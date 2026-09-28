import { NextResponse } from "next/server";
import { systemService } from "@/server/services/system.service";
import { formatErrorResponse } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const health = await systemService.getHealth();
    return NextResponse.json(health, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
