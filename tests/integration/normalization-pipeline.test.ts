import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { normalizationService } from "@/server/services/normalization.service";
import { resultsService } from "@/server/services/results.service";
import { ValidationError } from "@/lib/errors/app-error";

describe("Normalization Pipeline & Snapshot Immutability Integration", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";

  it("executes normalization run without modifying raw score records", async () => {
    // 1. Capture raw scores before normalization
    const rawScoresBefore = await prisma.score.findMany({
      where: { eventId },
      include: { items: true },
      orderBy: { id: "asc" },
    });
    expect(rawScoresBefore.length).toBeGreaterThan(0);

    // 2. Execute Z_SCORE normalization
    const runResult = await normalizationService.createRun(eventId, organizerId, {
      method: "Z_SCORE",
      outlierThreshold: 2.0,
    });

    expect(runResult.run).toBeDefined();
    expect(runResult.run.version).toBeGreaterThanOrEqual(1);
    expect(runResult.normalizedScoreCount).toBeGreaterThan(0);

    // 3. Verify raw scores after normalization remain byte-for-byte identical
    const rawScoresAfter = await prisma.score.findMany({
      where: { eventId },
      include: { items: true },
      orderBy: { id: "asc" },
    });

    expect(rawScoresAfter.length).toBe(rawScoresBefore.length);
    for (let i = 0; i < rawScoresBefore.length; i++) {
      const before = rawScoresBefore[i]!;
      const after = rawScoresAfter[i]!;

      expect(after.id).toBe(before.id);
      expect(after.items.length).toBe(before.items.length);

      for (let j = 0; j < before.items.length; j++) {
        expect(after.items[j]?.rawScore.toString()).toBe(before.items[j]?.rawScore.toString());
      }
    }
  });

  it("creates a result snapshot with explicit lifecycle (DRAFT -> FINALIZED -> PUBLISHED)", async () => {
    // 1. Create snapshot in DRAFT status
    const snapshot = await resultsService.createSnapshot(eventId, organizerId, {
      name: "Test Pipeline Snapshot",
      notes: "Testing versioning lifecycle",
    });

    expect(snapshot.id).toBeDefined();
    expect(snapshot.status).toBe("DRAFT");
    expect(snapshot.version).toBeGreaterThan(0);

    // 2. Finalize snapshot
    const finalized = await resultsService.finalizeSnapshot(eventId, snapshot.id, organizerId);
    expect(finalized.status).toBe("FINALIZED");
    expect(finalized.finalizedAt).not.toBeNull();

    // 3. Publish snapshot
    const published = await resultsService.publishSnapshot(eventId, snapshot.id, organizerId, {
      confirmPublish: true,
      transitionEventState: false,
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    // 4. Verifying published snapshot is permanently immutable
    await expect(
      resultsService.finalizeSnapshot(eventId, snapshot.id, organizerId)
    ).rejects.toThrow(ValidationError);
  });
});
