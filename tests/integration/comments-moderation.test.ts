import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { communityService } from "@/server/services/community.service";

describe("Submission Comments & Moderation Integration Tests (Phase 8)", () => {
  const eventId = "evt_raptor_2026";
  const submissionId = "sub_mesh_1";
  const commenter = {
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
  const organizerId = "usr_org_1";

  beforeEach(async () => {
    // Clean up test comments on submission1
    await prisma.comment.deleteMany({
      where: {
        eventId,
        submissionId,
        content: { contains: "Integration Test Comment" },
      },
    });
  });

  it("allows authenticated user to post a public comment with HTML sanitization", async () => {
    const rawContent =
      "Integration Test Comment: <b>Phenomenal</b> architecture! <script>alert(1)</script>";

    const comment = await communityService.createComment({
      eventId,
      submissionId,
      author: commenter,
      content: rawContent,
    });

    expect(comment).toBeDefined();
    expect(comment.id).toBeDefined();
    expect(comment.moderationStatus).toBe("PUBLISHED");
    expect(comment.content).toBe(
      "Integration Test Comment: Phenomenal architecture!"
    );
    expect(comment.content).not.toContain("<script>");
    expect(comment.content).not.toContain("<b>");

    // Verify audit log for comment creation
    const audit = await prisma.auditLog.findFirst({
      where: {
        eventId,
        actorId: commenter.id,
        action: "COMMENT_POSTED",
        entityId: comment.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it("filters out HIDDEN and REMOVED comments from the public comments query", async () => {
    // 1. Create a published comment
    const published = await communityService.createComment({
      eventId,
      submissionId,
      author: commenter,
      content: "Integration Test Comment: This is public.",
    });

    // 2. Create another comment and hide it
    const hidden = await communityService.createComment({
      eventId,
      submissionId,
      author: commenter,
      content: "Integration Test Comment: This should be hidden.",
    });
    await communityService.moderateComment(hidden.id, organizerId, "HIDDEN");

    // 3. Query public comments
    const { comments } = await communityService.getSubmissionComments(
      submissionId
    );

    const commentIds = comments.map((c) => c.id);
    expect(commentIds).toContain(published.id);
    expect(commentIds).not.toContain(hidden.id);
  });

  it("organizer can moderate a comment and update its status with audit logging", async () => {
    const comment = await communityService.createComment({
      eventId,
      submissionId,
      author: commenter,
      content: "Integration Test Comment: Inappropriate remark.",
    });

    // Moderate to HIDDEN
    const moderated = await communityService.moderateComment(
      comment.id,
      organizerId,
      "HIDDEN"
    );
    expect(moderated.moderationStatus).toBe("HIDDEN");
    expect(moderated.moderatedById).toBe(organizerId);
    expect(moderated.moderatedAt).not.toBeNull();

    // Verify audit entry
    const audit = await prisma.auditLog.findFirst({
      where: {
        eventId,
        actorId: organizerId,
        action: "COMMENT_MODERATED",
        entityId: comment.id,
      },
    });
    expect(audit).not.toBeNull();
    expect((audit?.metadata as { newStatus: string }).newStatus).toBe("HIDDEN");
  });
});
