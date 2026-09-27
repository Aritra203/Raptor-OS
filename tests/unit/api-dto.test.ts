import { describe, it, expect } from "vitest";
import {
  toUserDTO,
  toEventDTO,
  toSubmissionDTO,
  toWebhookDTO,
  toApiKeyDTO,
} from "@/server/dto/api-v1.dto";

describe("Phase 9 API DTO Sanitization", () => {
  it("toUserDTO strips passwordHash and internal properties", () => {
    const rawUser = {
      id: "usr_123",
      email: "alice@example.com",
      name: "Alice Builder",
      passwordHash: "secret_scrypt_hash_never_expose",
      avatarUrl: "https://avatar.example/123",
      bio: "Full stack developer",
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };

    const dto = toUserDTO(rawUser as unknown as Parameters<typeof toUserDTO>[0]);
    expect(dto.id).toBe("usr_123");
    expect(dto.email).toBe("alice@example.com");
    expect(dto.name).toBe("Alice Builder");
    expect((dto as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((dto as unknown as Record<string, unknown>).isActive).toBeUndefined();
  });

  it("toEventDTO exposes sanitized public event properties", () => {
    const rawEvent = {
      id: "evt_123",
      name: "Raptor Hack",
      slug: "raptor-hack",
      description: "Premier offline hackathon",
      state: "JUDGING_OPEN" as const,
      location: "Building 4",
      isVirtual: false,
      timezone: "UTC",
      registrationStart: new Date("2026-01-01T00:00:00Z"),
      registrationEnd: new Date("2026-02-01T00:00:00Z"),
      submissionsStart: new Date("2026-02-01T00:00:00Z"),
      submissionsEnd: new Date("2026-02-15T00:00:00Z"),
      judgingStart: new Date("2026-02-15T00:00:00Z"),
      judgingEnd: new Date("2026-02-20T00:00:00Z"),
      startsAt: new Date("2026-02-01T00:00:00Z"),
      endsAt: new Date("2026-02-22T00:00:00Z"),
      minTeamSize: 1,
      maxTeamSize: 4,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const dto = toEventDTO(rawEvent);
    expect(dto.id).toBe("evt_123");
    expect(dto.slug).toBe("raptor-hack");
    expect(dto.state).toBe("JUDGING_OPEN");
    expect(dto.minTeamSize).toBe(1);
  });

  it("toSubmissionDTO masks communityVoteCount unless authorized", () => {
    const rawSub = {
      id: "sub_123",
      eventId: "evt_123",
      teamId: "team_123",
      trackId: "trk_123",
      title: "RaptorMesh",
      description: "Decentralized mesh networking",
      repositoryUrl: "https://github.com/raptor/mesh",
      demoUrl: "https://mesh.raptor.local",
      deploymentUrl: null,
      documentationUrl: null,
      customData: null,
      state: "SUBMITTED" as const,
      submittedAt: new Date("2026-02-10T00:00:00Z"),
      lockedAt: null,
      createdAt: new Date("2026-02-05T00:00:00Z"),
      updatedAt: new Date("2026-02-10T00:00:00Z"),
      team: { name: "Team Neural" },
      track: { name: "AI Track" },
      _count: { votes: 42 },
    };

    const publicDto = toSubmissionDTO(rawSub as unknown as Parameters<typeof toSubmissionDTO>[0], false);
    expect(publicDto.communityVoteCount).toBeUndefined();

    const authDto = toSubmissionDTO(rawSub as unknown as Parameters<typeof toSubmissionDTO>[0], true);
    expect(authDto.communityVoteCount).toBe(42);
  });

  it("toWebhookDTO masks webhook secret", () => {
    const rawWebhook = {
      id: "wbhk_123",
      eventId: "evt_123",
      name: "Slack Notifier",
      url: "https://hooks.slack.com/services/123",
      secret: "whsec_super_confidential_secret_key_9999",
      events: ["results.published", "certificate.issued"],
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const dto = toWebhookDTO(rawWebhook);
    expect(dto.secretMasked).toBe("whse...9999");
    expect((dto as unknown as Record<string, unknown>).secret).toBeUndefined();
  });

  it("toApiKeyDTO never exposes keyHash", () => {
    const rawApiKey = {
      id: "key_123",
      userId: "usr_123",
      eventId: "evt_123",
      name: "CI Key",
      keyPrefix: "rap_live_abc123...",
      keyHash: "6f5b3...sha256hash",
      scopes: ["read"],
      lastUsedAt: null,
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      isRevoked: false,
      revokedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const dto = toApiKeyDTO(rawApiKey);
    expect(dto.keyPrefix).toBe("rap_live_abc123...");
    expect((dto as unknown as Record<string, unknown>).keyHash).toBeUndefined();
  });
});
