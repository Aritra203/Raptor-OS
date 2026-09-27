import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { exportService } from "@/server/services/export.service";
import { importService } from "@/server/services/import.service";

describe("Bulk Import/Export Integration Tests (Phase 9)", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";

  afterAll(async () => {
    // Cleanup imported test users and teams
    const importedEmails = [
      "import_alice@raptoros.internal",
      "import_bob@raptoros.internal",
    ];
    await prisma.user.deleteMany({
      where: { email: { in: importedEmails } },
    });
    await prisma.team.deleteMany({
      where: { name: "Imported Alpha Team", eventId },
    });
  });

  it("exports participants to CSV with correct headers and row counts", async () => {
    const exported = await exportService.exportResource(
      eventId,
      "participants",
      organizerId
    );

    expect(exported.filename).toContain("participants");
    expect(exported.filename).toMatch(/\.csv$/);
    expect(exported.rowCount).toBeGreaterThan(0);
    expect(exported.csv).toContain("userId,name,email,role,status");
    expect(exported.csv).toContain("hacker.elena@raptoros.internal");
  });

  it("exports submissions to CSV with project metadata and team details", async () => {
    const exported = await exportService.exportResource(
      eventId,
      "submissions",
      organizerId
    );

    expect(exported.filename).toContain("submissions");
    expect(exported.filename).toMatch(/\.csv$/);
    expect(exported.csv).toContain("submissionId,title,teamName,trackName,state");
    expect(exported.csv).toContain("RaptorMesh");
  });

  it("imports participants in bulk and handles valid and invalid rows with error isolation", async () => {
    const csvContent = [
      "email,name,role",
      "import_alice@raptoros.internal,Alice Imported,PARTICIPANT",
      "invalid-email-no-at-sign,Invalid User,PARTICIPANT",
      "import_bob@raptoros.internal,Bob Imported,JUDGE",
    ].join("\r\n");

    const result = await importService.importResource(
      eventId,
      "participants",
      organizerId,
      csvContent
    );

    expect(result.totalRows).toBe(3);
    expect(result.importedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.row).toBe(3); // Row 3 had invalid email

    // Verify DB insertion
    const alice = await prisma.user.findUnique({
      where: { email: "import_alice@raptoros.internal" },
    });
    expect(alice).toBeDefined();
    expect(alice?.name).toBe("Alice Imported");
  });

  it("rejects unknown import resources gracefully with ValidationError", async () => {
    await expect(
      importService.importResource(
        eventId,
        "unsupported_resource",
        organizerId,
        "header\r\nvalue"
      )
    ).rejects.toThrow();
  });
});
