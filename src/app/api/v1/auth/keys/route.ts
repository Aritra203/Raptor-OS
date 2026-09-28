import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/authorization";
import { apiKeyService } from "@/server/services/api-key.service";
import { createApiKeySchema } from "@/lib/validations/api-v1";
import { apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/auth/keys
 * Lists all API keys owned by the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(req);
    const keys = await apiKeyService.listUserApiKeys(user.id);
    return apiSuccess(keys);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/auth/keys
 * Generates a new API key for the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(req);
    const body = await req.json();
    const validated = createApiKeySchema.parse(body);

    const result = await apiKeyService.createApiKey(user.id, validated);
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
