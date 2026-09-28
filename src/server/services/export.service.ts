import { prisma } from "@/lib/db/prisma";
import { auditService } from "@/server/services/audit.service";
import { NotFoundError, ValidationError } from "@/lib/errors/app-error";

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRows(headers: string[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

export class ExportService {
  async exportResource(
    eventId: string,
    resource: string,
    actorId: string
  ): Promise<{ filename: string; csv: string; rowCount: number }> {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError("Event", eventId);
    }

    let result: { headers: string[]; rows: Array<Record<string, unknown>> };

    switch (resource.toLowerCase()) {
      case "participants":
        result = await this.getParticipants(eventId);
        break;
      case "teams":
        result = await this.getTeams(eventId);
        break;
      case "submissions":
        result = await this.getSubmissions(eventId);
        break;
      case "scores":
        result = await this.getScores(eventId);
        break;
      case "results":
        result = await this.getResults(eventId);
        break;
      case "votes":
        result = await this.getVotes(eventId);
        break;
      case "comments":
        result = await this.getComments(eventId);
        break;
      case "certificates":
        result = await this.getCertificates(eventId);
        break;
      default:
        throw new ValidationError(
          `Unsupported export resource: '${resource}'. Supported resources: participants, teams, submissions, scores, results, votes, comments, certificates.`
        );
    }

    const csv = toCsvRows(result.headers, result.rows);

    await auditService.logAction({
      eventId,
      actorId,
      action: "BULK_EXPORT_PERFORMED",
      entityType: "Event",
      entityId: eventId,
      metadata: { resource, rowCount: result.rows.length },
    });

    return {
      filename: `${event.slug}-${resource}-${new Date().toISOString().split("T")[0]}.csv`,
      csv,
      rowCount: result.rows.length,
    };
  }

  private async getParticipants(eventId: string) {
    const memberships = await prisma.eventMembership.findMany({
      where: { eventId },
      include: {
        user: {
          include: {
            teamMemberships: {
              where: { team: { eventId } },
              include: { team: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["userId", "name", "email", "role", "status", "teamName", "registeredAt"];
    const rows = memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      status: m.status,
      teamName: m.user.teamMemberships[0]?.team.name || "",
      registeredAt: m.createdAt.toISOString(),
    }));

    return { headers, rows };
  }

  private async getTeams(eventId: string) {
    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        track: true,
        submission: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    const headers = ["teamId", "name", "slug", "trackName", "memberCount", "submissionState", "createdAt"];
    const rows = teams.map((t) => ({
      teamId: t.id,
      name: t.name,
      slug: t.slug,
      trackName: t.track?.name || "",
      memberCount: t._count.members,
      submissionState: t.submission?.state || "NONE",
      createdAt: t.createdAt.toISOString(),
    }));

    return { headers, rows };
  }

  private async getSubmissions(eventId: string) {
    const submissions = await prisma.submission.findMany({
      where: { eventId },
      include: {
        team: true,
        track: true,
        _count: { select: { votes: true } },
      },
      orderBy: { title: "asc" },
    });

    const headers = ["submissionId", "title", "teamName", "trackName", "state", "repositoryUrl", "demoUrl", "voteCount", "submittedAt"];
    const rows = submissions.map((s) => ({
      submissionId: s.id,
      title: s.title,
      teamName: s.team.name,
      trackName: s.track?.name || "",
      state: s.state,
      repositoryUrl: s.repositoryUrl || "",
      demoUrl: s.demoUrl || "",
      voteCount: s._count.votes,
      submittedAt: s.submittedAt?.toISOString() || "",
    }));

    return { headers, rows };
  }

  private async getScores(eventId: string) {
    const scores = await prisma.score.findMany({
      where: { eventId, isFinal: true },
      include: {
        submission: true,
        judge: true,
        items: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["scoreId", "submissionId", "submissionTitle", "judgeId", "rawScore", "isFinal", "createdAt"];
    const rows = scores.map((s) => {
      const rawScore = s.items.reduce((acc, item) => acc + Number(item.rawScore), 0).toFixed(2);
      return {
        scoreId: s.id,
        submissionId: s.submissionId,
        submissionTitle: s.submission.title,
        judgeId: s.judgeId,
        rawScore,
        isFinal: s.isFinal,
        createdAt: s.createdAt.toISOString(),
      };
    });

    return { headers, rows };
  }

  private async getResults(eventId: string) {
    const snapshot = await prisma.resultSnapshot.findFirst({
      where: { eventId, status: "PUBLISHED" },
      include: {
        results: {
          include: {
            submission: { include: { team: true } },
            track: true,
            prize: true,
          },
          orderBy: { rank: "asc" },
        },
      },
    });

    const headers = ["rank", "trackRank", "title", "teamName", "trackName", "prizeName", "finalScore", "rawAggregateScore"];
    const rows = (snapshot?.results || []).map((r) => ({
      rank: r.rank,
      trackRank: r.trackRank || "",
      title: r.submission.title,
      teamName: r.submission.team.name,
      trackName: r.track?.name || "",
      prizeName: r.prize?.name || "",
      finalScore: r.finalScore.toString(),
      rawAggregateScore: r.rawAggregateScore.toString(),
    }));

    return { headers, rows };
  }

  private async getVotes(eventId: string) {
    const votes = await prisma.vote.findMany({
      where: { eventId },
      include: { submission: true },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["voteId", "submissionId", "submissionTitle", "voterId", "createdAt"];
    const rows = votes.map((v) => ({
      voteId: v.id,
      submissionId: v.submissionId,
      submissionTitle: v.submission.title,
      voterId: v.voterId,
      createdAt: v.createdAt.toISOString(),
    }));

    return { headers, rows };
  }

  private async getComments(eventId: string) {
    const comments = await prisma.comment.findMany({
      where: { eventId, isDeleted: false },
      include: { submission: true, user: true },
      orderBy: { createdAt: "asc" },
    });

    const headers = ["commentId", "submissionId", "submissionTitle", "authorName", "content", "moderationStatus", "createdAt"];
    const rows = comments.map((c) => ({
      commentId: c.id,
      submissionId: c.submissionId,
      submissionTitle: c.submission.title,
      authorName: c.user.name,
      content: c.content,
      moderationStatus: c.moderationStatus,
      createdAt: c.createdAt.toISOString(),
    }));

    return { headers, rows };
  }

  private async getCertificates(eventId: string) {
    const certs = await prisma.certificate.findMany({
      where: { eventId },
      include: { recipient: true },
      orderBy: { issuedAt: "desc" },
    });

    const headers = ["certificateId", "verificationId", "recipientName", "recipientEmail", "type", "title", "isRevoked", "issuedAt"];
    const rows = certs.map((c) => ({
      certificateId: c.id,
      verificationId: c.verificationId,
      recipientName: c.recipient.name,
      recipientEmail: c.recipient.email,
      type: c.type,
      title: c.title,
      isRevoked: c.isRevoked,
      issuedAt: c.issuedAt.toISOString(),
    }));

    return { headers, rows };
  }
}

export const exportService = new ExportService();
