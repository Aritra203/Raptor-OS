import { NextRequest, NextResponse } from "next/server";
import { resolveSessionUser } from "@/server/auth/authorization";
import { formatErrorResponse } from "@/lib/errors/app-error";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveSessionUser(req);

    if (!auth) {
      return NextResponse.json(
        {
          data: {
            user: null,
            authenticated: false,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        data: {
          user: auth.user,
          authenticated: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return formatErrorResponse(error);
  }
}
