import { PrismaClient } from "@prisma/client";
import { DatabaseError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isDev = process.env.NODE_ENV === "development";

  return new PrismaClient({
    log: isDev
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : [
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Verifies live database connectivity.
 * Returns response latency in milliseconds or throws DatabaseError.
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    // Lightweight check to verify active connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return { ok: true, latencyMs };
  } catch (error) {
    logger.error("Database health check failed", error);
    throw new DatabaseError("Failed to communicate with the database.");
  }
}
