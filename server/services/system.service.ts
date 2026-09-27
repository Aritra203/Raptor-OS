import { systemRepository } from "@/server/repositories/system.repository";
import { DatabaseError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger/logger";

export interface HealthCheckResult {
  status: "ok" | "error";
  service: string;
  database: "ok" | "down";
  latencyMs?: number;
  version?: string;
}

export class SystemService {
  /**
   * Evaluates application and database health.
   * Throws DatabaseError if the database is unreachable.
   */
  async getHealth(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    try {
      await systemRepository.ping();
      const latencyMs = Math.round(performance.now() - startTime);

      let version = "0.1.0";
      try {
        const verSetting = await systemRepository.findByKey("platform.version");
        if (verSetting) {
          version = verSetting.value;
        }
      } catch {
        // Ping succeeded; setting retrieval failure is non-fatal for base health
      }

      return {
        status: "ok",
        service: "raptoros",
        database: "ok",
        latencyMs,
        version,
      };
    } catch (error) {
      logger.error("Health check database probe failed", error);
      throw new DatabaseError("The database is currently unavailable.");
    }
  }

  /**
   * Retrieves initialized platform metadata.
   */
  async getPlatformInfo(): Promise<Record<string, string>> {
    try {
      const settings = await systemRepository.findAll();
      const info: Record<string, string> = {};
      for (const s of settings) {
        info[s.key] = s.value;
      }
      return info;
    } catch (error) {
      logger.error("Failed to load platform info", error);
      throw new DatabaseError("Unable to retrieve platform metadata.");
    }
  }
}

export const systemService = new SystemService();
