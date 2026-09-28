import { prisma } from "@/lib/db/prisma";

export interface SystemSettingRecord {
  key: string;
  value: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SystemRepository {
  /**
   * Ping database with a lightweight SELECT 1 query.
   */
  async ping(): Promise<boolean> {
    const result = await prisma.$queryRaw<Array<{ "?column?": number }>>`SELECT 1`;
    return Array.isArray(result) && result.length > 0;
  }

  /**
   * Find a specific system setting by key.
   */
  async findByKey(key: string): Promise<SystemSettingRecord | null> {
    return prisma.systemSetting.findUnique({
      where: { key },
    });
  }

  /**
   * List all stored system settings.
   */
  async findAll(): Promise<SystemSettingRecord[]> {
    return prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });
  }

  /**
   * Upsert a system setting.
   */
  async upsertSetting(key: string, value: string, description?: string): Promise<SystemSettingRecord> {
    return prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }
}

export const systemRepository = new SystemRepository();
