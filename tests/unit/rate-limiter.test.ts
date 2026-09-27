import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "@/server/auth/rate-limiter";

describe("Rate Limiter Unit Tests", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  it("allows attempts within the limit", () => {
    const key = "test:ip:1";
    const limit = 3;
    const windowMs = 60 * 1000;

    const res1 = limiter.check(key, limit, windowMs);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(3);

    limiter.hit(key, windowMs);
    const res2 = limiter.check(key, limit, windowMs);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(2);

    limiter.hit(key, windowMs);
    const res3 = limiter.check(key, limit, windowMs);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(1);
  });

  it("blocks requests once the threshold is exceeded", () => {
    const key = "test:ip:2";
    const limit = 2;
    const windowMs = 60 * 1000;

    limiter.hit(key, windowMs);
    limiter.hit(key, windowMs);

    const check = limiter.check(key, limit, windowMs);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets rate limit for a key", () => {
    const key = "test:ip:3";
    const limit = 1;
    const windowMs = 60 * 1000;

    limiter.hit(key, windowMs);
    expect(limiter.check(key, limit, windowMs).allowed).toBe(false);

    limiter.reset(key);
    expect(limiter.check(key, limit, windowMs).allowed).toBe(true);
  });

  it("isolates different keys independently", () => {
    const keyA = "ip:user:a";
    const keyB = "ip:user:b";
    const limit = 1;
    const windowMs = 60 * 1000;

    limiter.hit(keyA, windowMs);
    expect(limiter.check(keyA, limit, windowMs).allowed).toBe(false);
    expect(limiter.check(keyB, limit, windowMs).allowed).toBe(true);
  });
});
