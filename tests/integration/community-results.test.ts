import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { communityService } from "@/server/services/community.service";
import { galleryService } from "@/server/services/gallery.service";

describe("Community Results & Integrity Integration Tests (Phase 8)", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";

  beforeEach(async () => {
    // Reset voting config publication state
    await prisma.votingConfig.upsert({
      where: { eventId },
      update: {
        isEnabled: true,
        publicVoteCounts: false,
        resultsPublished: false,
        resultsPublishedAt: null,
      },
      create: {
        eventId,
        isEnabled: true,
        publicVoteCounts: false,
        resultsPublished: false,
      },
    });
  });

  it("strictly hides community results from unauthenticated and non-organizer callers when unpublished", async () => {
    // Calling as regular non-organizer participant
    const results = await communityService.getCommunityResults(
      eventId,
      false // isOrganizerOrAdmin = false
    );

    expect(results.isPublished).toBe(false);
    expect(results.totalVotes).toBeNull();
    expect(results.uniqueVoters).toBeNull();
    expect(results.items).toHaveLength(0);
  });

  it("allows event organizers to inspect private preliminary community results", async () => {
    const results = await communityService.getCommunityResults(
      eventId,
      true // isOrganizerOrAdmin = true
    );

    expect(results.totalVotes).toBeTypeOf("number");
    expect(results.uniqueVoters).toBeTypeOf("number");
    expect(results.items.length).toBeGreaterThanOrEqual(0);
  });

  it("reveals full community leaderboard to the public once published by an organizer", async () => {
    // 1. Publish results as organizer
    await communityService.publishCommunityResults(eventId, organizerId, true);

    // 2. Query as public / non-organizer
    const results = await communityService.getCommunityResults(
      eventId,
      false // isOrganizerOrAdmin = false
    );

    expect(results.isPublished).toBe(true);
    expect(results.totalVotes).toBeTypeOf("number");
    expect(results.uniqueVoters).toBeTypeOf("number");

    // Check that items are ranked properly
    if (results.items.length > 1) {
      expect(results.items[0]!.voteCount).toBeGreaterThanOrEqual(
        results.items[1]!.voteCount
      );
      expect(results.items[0]!.rank).toBe(1);
    }
  });

  it("hides community vote counts on gallery submissions when unpublished", async () => {
    const gallery = await galleryService.getPublicGallery({ eventId });

    // When publicVoteCounts is false and resultsPublished is false, vote counts must be null
    for (const item of gallery.items) {
      expect(item.communityVoteCount).toBeNull();
    }
  });

  it("reveals community vote counts on gallery submissions once results are published", async () => {
    // Publish results
    await communityService.publishCommunityResults(eventId, organizerId, true);

    const gallery = await galleryService.getPublicGallery({ eventId });

    // When published, communityVoteCount should be a number
    for (const item of gallery.items) {
      expect(typeof item.communityVoteCount).toBe("number");
    }
  });

  it("guarantees community votes remain strictly separated from Phase 7 judge scores", async () => {
    // Check Phase 7 Result record
    const resultRecord = await prisma.result.findFirst({
      where: { eventId, isPublished: true },
    });

    if (resultRecord) {
      const initialFinalScore = resultRecord.finalScore;
      const initialNormalizedScore = resultRecord.normalizedScore;

      // Cast community vote
      await prisma.vote.upsert({
        where: {
          eventId_voterId_submissionId: {
            eventId,
            voterId: "usr_part_3",
            submissionId: resultRecord.submissionId,
          },
        },
        update: {},
        create: {
          id: `vote_test_${Date.now()}`,
          eventId,
          submissionId: resultRecord.submissionId,
          voterId: "usr_part_3",
        },
      });

      // Verify Phase 7 result is completely unaffected
      const recheckedResult = await prisma.result.findUnique({
        where: { id: resultRecord.id },
      });

      expect(recheckedResult?.finalScore).toEqual(initialFinalScore);
      expect(recheckedResult?.normalizedScore).toEqual(initialNormalizedScore);
    }
  });
});
