import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { communityService } from "@/server/services/community.service";
import { ForbiddenError, ConflictError } from "@/lib/errors/app-error";

describe("Community Voting Integration Tests (Phase 8)", () => {
  const eventId = "evt_raptor_2026";
  const submissionId = "sub_mesh_1"; // team1 project (creator: usr_part_1, member: usr_part_2)
  const voterUser = {
    id: "usr_part_3",
    email: "hacker.grace@raptoros.internal",
    name: "Grace Dev",
    avatarUrl: null,
    bio: null,
    lastLoginAt: null,
    isGlobalAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const teamCreatorUser = {
    id: "usr_part_1",
    email: "hacker.elena@raptoros.internal",
    name: "Elena Builder",
    avatarUrl: null,
    bio: null,
    lastLoginAt: null,
    isGlobalAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const teamMemberUser = {
    id: "usr_part_2",
    email: "hacker.frank@raptoros.internal",
    name: "Frank Coder",
    avatarUrl: null,
    bio: null,
    lastLoginAt: null,
    isGlobalAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Reset test votes for clean state
    await prisma.vote.deleteMany({
      where: {
        eventId,
        submissionId,
        voterId: { in: [voterUser.id, teamCreatorUser.id, teamMemberUser.id] },
      },
    });

    // Ensure voting is enabled for event1 with self-voting disallowed
    await prisma.votingConfig.upsert({
      where: { eventId },
      update: {
        isEnabled: true,
        allowSelfVoting: false,
        allowParticipantVotes: true,
        allowJudgeVotes: true,
        votingStart: null,
        votingEnd: null,
      },
      create: {
        eventId,
        isEnabled: true,
        allowSelfVoting: false,
        allowParticipantVotes: true,
        allowJudgeVotes: true,
      },
    });
  });

  it("allows eligible community voter to cast a valid vote", async () => {
    const result = await communityService.castVote({
      eventId,
      submissionId,
      voter: voterUser,
    });

    expect(result.success).toBe(true);
    expect(result.voteId).toBeDefined();

    const status = await communityService.getSubmissionVoteStatus(
      eventId,
      submissionId,
      voterUser.id
    );
    expect(status.hasVoted).toBe(true);
    expect(status.voteId).toBe(result.voteId);
  });

  it("strictly prevents duplicate votes and returns ConflictError (409)", async () => {
    // Cast initial vote
    await communityService.castVote({
      eventId,
      submissionId,
      voter: voterUser,
    });

    // Second vote attempt on same submission must fail with ConflictError
    await expect(
      communityService.castVote({
        eventId,
        submissionId,
        voter: voterUser,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("strictly prevents team creator from voting for their own submission", async () => {
    await expect(
      communityService.castVote({
        eventId,
        submissionId,
        voter: teamCreatorUser,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("strictly prevents team members from voting for their team submission", async () => {
    await expect(
      communityService.castVote({
        eventId,
        submissionId,
        voter: teamMemberUser,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("permits voter to retract their vote with append-only audit logging", async () => {
    // Cast vote first
    const result = await communityService.castVote({
      eventId,
      submissionId,
      voter: voterUser,
    });

    // Retract vote
    const retraction = await communityService.retractVote({
      eventId,
      submissionId,
      voterId: voterUser.id,
    });

    expect(retraction.retracted).toBe(true);
    expect(retraction.voteId).toBe(result.voteId);

    // Verify status reflects no vote
    const status = await communityService.getSubmissionVoteStatus(
      eventId,
      submissionId,
      voterUser.id
    );
    expect(status.hasVoted).toBe(false);

    // Verify audit log entry was created
    const audit = await prisma.auditLog.findFirst({
      where: {
        eventId,
        actorId: voterUser.id,
        action: "VOTE_RETRACTED",
        entityId: result.voteId,
      },
      orderBy: { timestamp: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects voting when voting configuration is disabled", async () => {
    // Disable voting
    await prisma.votingConfig.update({
      where: { eventId },
      data: { isEnabled: false },
    });

    await expect(
      communityService.castVote({
        eventId,
        submissionId,
        voter: voterUser,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces cross-event isolation when voting", async () => {
    const wrongEventId = "evt_global_ai_2026";

    // Attempt to vote on event1's submission using event2's context
    await expect(
      communityService.castVote({
        eventId: wrongEventId,
        submissionId,
        voter: voterUser,
      })
    ).rejects.toThrow();
  });
});
