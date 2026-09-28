import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { auditService } from "@/server/services/audit.service";
import { hashPassword } from "@/server/auth/password";
import {
  importParticipantRowSchema,
  importTeamRowSchema,
  importSubmissionRowSchema,
} from "@/lib/validations/api-v1";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";
import type { EventRole } from "@prisma/client";

export interface RowError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: RowError[];
}

/**
 * Standard RFC-4180 CSV parser supporting quoted values, linebreaks, and escaped quotes.
 */
export function parseCsvString(csv: string): Array<Record<string, string>> {
  const clean = csv.replace(/^\uFEFF/, "").trim(); // Strip UTF-8 BOM
  if (!clean) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0 || !rows[0]) return [];

  const headerRow = rows[0];
  const headers = headerRow.map((h) => h.toLowerCase().trim());
  const parsedObjects: Array<Record<string, string>> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const headerKey = headers[j];
      if (headerKey) {
        obj[headerKey] = row[j] ?? "";
      }
    }
    parsedObjects.push(obj);
  }

  return parsedObjects;
}

export class ImportService {
  async importResource(
    eventId: string,
    resource: string,
    actorId: string,
    csvContent: string
  ): Promise<ImportResult> {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError("Event", eventId);
    }

    let result: ImportResult;

    switch (resource.toLowerCase()) {
      case "participants":
        result = await this.importParticipants(eventId, actorId, csvContent);
        break;
      case "teams":
        result = await this.importTeams(eventId, actorId, csvContent);
        break;
      case "submissions":
        result = await this.importSubmissions(eventId, actorId, csvContent);
        break;
      default:
        throw new ValidationError(
          `Unsupported import resource: '${resource}'. Supported resources: participants, teams, submissions.`
        );
    }

    await auditService.logAction({
      eventId,
      actorId,
      action: "BULK_IMPORT_PERFORMED",
      entityType: "Event",
      entityId: eventId,
      metadata: {
        resource,
        totalRows: result.totalRows,
        importedCount: result.importedCount,
        failedCount: result.failedCount,
      },
    });

    return result;
  }

  private async importParticipants(
    eventId: string,
    actorId: string,
    csvContent: string
  ): Promise<ImportResult> {
    const records = parseCsvString(csvContent);
    const errors: RowError[] = [];
    let importedCount = 0;

    for (let index = 0; index < records.length; index++) {
      const rowNumber = index + 2; // Row 1 is header
      const raw = records[index];
      if (!raw) continue;

      const parseResult = importParticipantRowSchema.safeParse(raw);
      if (!parseResult.success) {
        errors.push({
          row: rowNumber,
          field: parseResult.error.errors[0]?.path.join("."),
          message: parseResult.error.errors[0]?.message || "Validation failed",
        });
        continue;
      }

      const { email, name, role } = parseResult.data;

      try {
        // Upsert user (never storing plaintext passwords; set random password hash)
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const tempPassword = crypto.randomBytes(16).toString("hex");
          const passwordHash = await hashPassword(tempPassword);
          user = await prisma.user.create({
            data: {
              email,
              name,
              passwordHash,
            },
          });
        }

        // Upsert event membership
        await prisma.eventMembership.upsert({
          where: {
            userId_eventId_role: {
              userId: user.id,
              eventId,
              role: role as EventRole,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            userId: user.id,
            eventId,
            role: role as EventRole,
            status: "ACTIVE",
          },
        });

        importedCount++;
      } catch (err: unknown) {
        errors.push({
          row: rowNumber,
          message: (err as Error)?.message || "Failed to persist participant record",
        });
      }
    }

    return {
      totalRows: records.length,
      importedCount,
      failedCount: errors.length,
      errors,
    };
  }

  private async importTeams(
    eventId: string,
    actorId: string,
    csvContent: string
  ): Promise<ImportResult> {
    const records = parseCsvString(csvContent);
    const errors: RowError[] = [];
    let importedCount = 0;

    for (let index = 0; index < records.length; index++) {
      const rowNumber = index + 2;
      const raw = records[index];
      if (!raw) continue;

      const parseResult = importTeamRowSchema.safeParse({
        name: raw.name || raw.teamname,
        leaderEmail: raw.leaderemail || raw.leader_email || raw.email,
        trackSlug: raw.trackslug || raw.track_slug || raw.track,
      });

      if (!parseResult.success) {
        errors.push({
          row: rowNumber,
          field: parseResult.error.errors[0]?.path.join("."),
          message: parseResult.error.errors[0]?.message || "Validation failed",
        });
        continue;
      }

      const { name, leaderEmail, trackSlug } = parseResult.data;

      try {
        const leader = await prisma.user.findUnique({
          where: { email: leaderEmail },
        });
        if (!leader) {
          errors.push({
            row: rowNumber,
            field: "leaderEmail",
            message: `User with email '${leaderEmail}' not found. Import participant first.`,
          });
          continue;
        }

        let trackId: string | null = null;
        if (trackSlug) {
          const track = await prisma.track.findFirst({
            where: { eventId, slug: trackSlug },
          });
          if (track) {
            trackId = track.id;
          }
        }

        const teamSlug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto
          .randomBytes(3)
          .toString("hex")}`;

        // Create team and assign leader atomically
        await prisma.team.create({
          data: {
            eventId,
            name,
            slug: teamSlug,
            trackId,
            creatorId: leader.id,
            members: {
              create: {
                userId: leader.id,
                role: "LEADER",
              },
            },
          },
        });

        importedCount++;
      } catch (err: unknown) {
        errors.push({
          row: rowNumber,
          message: (err as Error)?.message || "Failed to create team",
        });
      }
    }

    return {
      totalRows: records.length,
      importedCount,
      failedCount: errors.length,
      errors,
    };
  }

  private async importSubmissions(
    eventId: string,
    actorId: string,
    csvContent: string
  ): Promise<ImportResult> {
    const records = parseCsvString(csvContent);
    const errors: RowError[] = [];
    let importedCount = 0;

    for (let index = 0; index < records.length; index++) {
      const rowNumber = index + 2;
      const raw = records[index];
      if (!raw) continue;

      const parseResult = importSubmissionRowSchema.safeParse({
        teamName: raw.teamname || raw.team_name || raw.team,
        title: raw.title,
        description: raw.description,
        repositoryUrl: raw.repositoryurl || raw.repository_url || raw.repo,
        demoUrl: raw.demourl || raw.demo_url,
        trackSlug: raw.trackslug || raw.track_slug || raw.track,
      });

      if (!parseResult.success) {
        errors.push({
          row: rowNumber,
          field: parseResult.error.errors[0]?.path.join("."),
          message: parseResult.error.errors[0]?.message || "Validation failed",
        });
        continue;
      }

      const { teamName, title, description, repositoryUrl, demoUrl, trackSlug } =
        parseResult.data;

      try {
        const team = await prisma.team.findFirst({
          where: { eventId, name: teamName },
          include: { submission: true },
        });

        if (!team) {
          errors.push({
            row: rowNumber,
            field: "teamName",
            message: `Team '${teamName}' not found in this event.`,
          });
          continue;
        }

        if (team.submission) {
          errors.push({
            row: rowNumber,
            field: "teamName",
            message: `Team '${teamName}' already has a submission.`,
          });
          continue;
        }

        let trackId = team.trackId;
        if (trackSlug) {
          const track = await prisma.track.findFirst({
            where: { eventId, slug: trackSlug },
          });
          if (track) {
            trackId = track.id;
          }
        }

        await prisma.submission.create({
          data: {
            eventId,
            teamId: team.id,
            trackId,
            title,
            description,
            repositoryUrl: repositoryUrl || null,
            demoUrl: demoUrl || null,
            state: "SUBMITTED",
            submittedAt: new Date(),
          },
        });

        importedCount++;
      } catch (err: unknown) {
        errors.push({
          row: rowNumber,
          message: (err as Error)?.message || "Failed to create submission",
        });
      }
    }

    return {
      totalRows: records.length,
      importedCount,
      failedCount: errors.length,
      errors,
    };
  }
}

export const importService = new ImportService();
