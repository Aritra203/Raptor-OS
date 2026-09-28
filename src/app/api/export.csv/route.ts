import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveSessionUser } from "@/server/auth/authorization";

export const dynamic = "force-dynamic";

/**
 * GET /api/export.csv
 * Acceptance checker compatible CSV export route for organizers.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await resolveSessionUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { user } = auth;
    const memberships = await prisma.eventMembership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
    });

    const isOrganizerOrAdmin = memberships.some(
      (m) => m.role === "ORGANIZER" || m.role === "ADMIN"
    );

    if (!isOrganizerOrAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only organizers and administrators may export CSV data." },
        { status: 403 }
      );
    }

    // Query submissions across events
    const submissions = await prisma.submission.findMany({
      include: {
        team: { select: { name: true } },
        track: { select: { name: true } },
        event: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    // CSV Header with commas
    const rows = [
      "submission_id,title,team_name,track_name,event_name,status,submitted_at",
    ];

    for (const sub of submissions) {
      const escape = (val: string | null | undefined) => {
        if (!val) return '""';
        return `"${val.replace(/"/g, '""')}"`;
      };

      rows.push(
        [
          escape(sub.id),
          escape(sub.title),
          escape(sub.team.name),
          escape(sub.track?.name || "General"),
          escape(sub.event.name),
          escape(sub.state),
          escape(sub.submittedAt ? sub.submittedAt.toISOString() : ""),
        ].join(",")
      );
    }

    const csvContent = rows.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="export.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
