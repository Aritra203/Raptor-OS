import { NextRequest } from "next/server";
import { resolveSessionUser } from "@/server/auth/authorization";
import { apiSuccess, apiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { toUserDTO } from "@/server/dto/api-v1.dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user identity, active session, and event memberships.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await resolveSessionUser(req);
    if (!auth) {
      throw new UnauthorizedError("Authentication is required to access /api/v1/auth/me.");
    }

    const userDto = toUserDTO(auth.user);

    return apiSuccess({
      user: userDto,
      memberships: auth.user.eventMemberships?.map((m) => ({
        id: m.id,
        eventId: m.eventId,
        role: m.role,
        status: m.status,
      })) || [],
      session: {
        id: auth.session.id,
        expiresAt: auth.session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
