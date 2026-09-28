import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import { buildSessionCookieOptions } from "@/server/auth/session";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const result = await authService.register({
      name: body.name,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword,
      userAgent,
      ipAddress,
    });

    const cookieOpts = buildSessionCookieOptions(result.sessionToken);

    const response = NextResponse.json(
      {
        data: {
          user: result.user,
        },
      },
      { status: 201 }
    );

    response.cookies.set({
      name: cookieOpts.name,
      value: cookieOpts.value,
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return response;
  } catch (error) {
    return formatErrorResponse(error);
  }
}
