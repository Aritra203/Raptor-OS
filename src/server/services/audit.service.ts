import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export interface LogAuditOptions {
  eventId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async log(options: LogAuditOptions) {
    try {
      return await prisma.auditLog.create({
        data: {
          eventId: options.eventId || null,
          actorId: options.actorId || null,
          action: options.action,
          entityType: options.entityType,
          entityId: options.entityId,
          metadata: (options.metadata || {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
      // Non-blocking in case of audit failure, or allow it to be captured
    }
  }

  async logAction(options: LogAuditOptions) {
    return this.log(options);
  }
}

export const auditService = new AuditService();
