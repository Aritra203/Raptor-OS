import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import { extractSessionToken } from "@/server/auth/authorization";
import { buildClearSessionCookieOptions } from "@/server/auth/session";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(req: NextRequest) {
  try {
    const token = await extractSessionToken(req);

    if (token) {
      await authService.logout(token);
    }

    const clearOpts = buildClearSessionCookieOptions();

    const response = NextResponse.json(
      {
        data: {
          success: true,
          message: "Successfully logged out.",
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: clearOpts.name,
      value: clearOpts.value,
      httpOnly: clearOpts.httpOnly,
      secure: clearOpts.secure,
      sameSite: clearOpts.sameSite,
      path: clearOpts.path,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return formatErrorResponse(error);
  }
}
