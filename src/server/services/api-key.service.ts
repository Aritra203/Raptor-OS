import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { auditService } from "@/server/services/audit.service";
import { NotFoundError, ForbiddenError } from "@/lib/errors/app-error";
import type { ApiKeyDTO } from "@/server/dto/api-v1.dto";
import { toApiKeyDTO } from "@/server/dto/api-v1.dto";

export class ApiKeyService {
  /**
   * Generates a cryptographically random API key.
   * Format: rap_live_<48-hex-chars>
   */
  generateRawKey(): string {
    return `rap_live_${crypto.randomBytes(24).toString("hex")}`;
  }

  /**
   * Creates and persists a hashed API key. Returns the plaintext secret key ONCE.
   */
  async createApiKey(
    userId: string,
    input: {
      name: string;
      eventId?: string | null;
      scopes?: string[];
      expiresInDays?: number;
    }
  ): Promise<{ apiKey: ApiKeyDTO; secretKey: string }> {
    const rawKey = this.generateRawKey();
    const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const days = input.expiresInDays ?? 90;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        eventId: input.eventId || null,
        name: input.name,
        keyPrefix,
        keyHash,
        scopes: (input.scopes || ["read", "write"]) as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    await auditService.logAction({
      eventId: input.eventId || null,
      actorId: userId,
      action: "API_KEY_CREATED",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: { name: apiKey.name, keyPrefix },
    });

    return {
      apiKey: toApiKeyDTO(apiKey),
      secretKey: rawKey,
    };
  }

  /**
   * Lists all API keys owned by a user.
   */
  async listUserApiKeys(userId: string): Promise<ApiKeyDTO[]> {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return keys.map(toApiKeyDTO);
  }

  /**
   * Revokes an API key.
   */
  async revokeApiKey(userId: string, keyId: string): Promise<ApiKeyDTO> {
    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) {
      throw new NotFoundError("API key", keyId);
    }
    if (key.userId !== userId) {
      throw new ForbiddenError("You can only revoke your own API keys.");
    }

    const updated = await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await auditService.logAction({
      eventId: key.eventId,
      actorId: userId,
      action: "API_KEY_REVOKED",
      entityType: "ApiKey",
      entityId: key.id,
      metadata: { name: key.name, keyPrefix: key.keyPrefix },
    });

    return toApiKeyDTO(updated);
  }
}

export const apiKeyService = new ApiKeyService();
