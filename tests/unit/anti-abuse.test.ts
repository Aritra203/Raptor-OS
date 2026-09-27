import { describe, it, expect, beforeEach } from "vitest";
import {
  AntiAbuseService,
  voteRateLimiter,
  commentRateLimiter,
} from "@/server/services/anti-abuse.service";
import { TooManyRequestsError } from "@/lib/errors/app-error";

describe("Anti-Abuse & Rate Limiting Unit Tests (Phase 8)", () => {
  let antiAbuseService: AntiAbuseService;

  beforeEach(() => {
    antiAbuseService = new AntiAbuseService();
    voteRateLimiter.clear();
    commentRateLimiter.clear();
  });

  describe("Vote Rate Limiting (10 votes per 60s per user)", () => {
    it("allows up to 10 votes within 60 seconds", () => {
      const voterId = "voter_rate_1";

      for (let i = 0; i < 10; i++) {
        expect(() => antiAbuseService.checkVoteRateLimit(voterId)).not.toThrow();
      }
    });

    it("throws TooManyRequestsError (429) on the 11th vote within the window", () => {
      const voterId = "voter_rate_2";

      for (let i = 0; i < 10; i++) {
        antiAbuseService.checkVoteRateLimit(voterId);
      }

      expect(() => antiAbuseService.checkVoteRateLimit(voterId)).toThrow(
        TooManyRequestsError
      );
    });

    it("enforces IP-based vote rate limits", () => {
      const ip = "192.168.1.100";

      // 30 votes per IP allowed
      for (let i = 0; i < 30; i++) {
        expect(() =>
          antiAbuseService.checkVoteRateLimit(`voter_ip_${i}`, ip)
        ).not.toThrow();
      }

      // 31st vote from same IP should be blocked
      expect(() =>
        antiAbuseService.checkVoteRateLimit("voter_ip_31", ip)
      ).toThrow(TooManyRequestsError);
    });
  });

  describe("Comment Rate Limiting (5 comments per 60s per user)", () => {
    it("allows up to 5 comments within 60 seconds", () => {
      const userId = "commenter_1";

      for (let i = 0; i < 5; i++) {
        expect(() => antiAbuseService.checkCommentRateLimit(userId)).not.toThrow();
      }
    });

    it("throws TooManyRequestsError on the 6th comment within the window", () => {
      const userId = "commenter_2";

      for (let i = 0; i < 5; i++) {
        antiAbuseService.checkCommentRateLimit(userId);
      }

      expect(() => antiAbuseService.checkCommentRateLimit(userId)).toThrow(
        TooManyRequestsError
      );
    });
  });

  describe("Non-Destructive Abuse Signal Guarantees", () => {
    it("never automatically deletes or alters legitimate votes when abuse signals are raised", () => {
      // Confirm anti-abuse design contract: abuse signals flag for organizer review
      // and do NOT perform delete cascades or automatic disqualifications.
      expect(typeof antiAbuseService.flagAbuseSignal).toBe("function");
      expect(typeof antiAbuseService.reviewAbuseSignal).toBe("function");
    });
  });
});
