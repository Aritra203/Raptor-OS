import { describe, it, expect, vi } from "vitest";
import { galleryService } from "@/server/services/gallery.service";
import { submissionRepository } from "@/server/repositories/submission.repository";

describe("Gallery DTO Serialization (Unit Tests)", () => {
  it("strictly excludes private user emails, tokens, and internal judge metadata", async () => {
    vi.spyOn(submissionRepository, "findPublicGallerySubmissions").mockResolvedValue({
      items: [
        {
          id: "sub_mesh_1",
          title: "RaptorMesh",
          description: "A decentralized peer to peer networking protocol.",
          repositoryUrl: "https://github.com/raptoros/raptormesh",
          demoUrl: "https://demo.raptoros.internal",
          deploymentUrl: null,
          documentationUrl: null,
          state: "SUBMITTED",
          submittedAt: new Date("2026-02-14T18:30:00Z"),
          event: {
            id: "evt_raptor_2026",
            name: "Raptor Hack 2026",
            slug: "raptor-hack-2026",
          },
          track: {
            id: "trk_ai_1",
            name: "AI Agents",
            slug: "ai-agents",
          },
          team: {
            id: "team_raptor_core",
            name: "Raptor Core",
            slug: "team-raptor-core",
            members: [
              {
                user: {
                  name: "Elena Builder",
                  email: "elena@private-leak.com",
                  passwordHash: "$argon2id$secretHash",
                },
              },
            ],
          },
        },
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      totalCount: 1,
      page: 1,
      limit: 12,
      totalPages: 1,
    });

    const result = await galleryService.getPublicGallery();
    expect(result.items).toHaveLength(1);

    const dto = result.items[0]!;
    expect(dto.title).toBe("RaptorMesh");
    expect(dto.team.name).toBe("Raptor Core");
    expect(dto.team.memberNames).toEqual(["Elena Builder"]);

    // Strict assertions against private leakage
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("elena@private-leak.com");
    expect(serialized).not.toContain("secretHash");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("tokens");
    expect(serialized).not.toContain("email");
  });
});
