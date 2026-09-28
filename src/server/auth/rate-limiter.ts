/**
 * In-memory sliding-window rate limiter for brute-force protection.
 * Self-contained, offline, with zero external infrastructure requirements (no Redis).
 */

interface RateLimitEntry {
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds?: number;
}

export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly cleanupIntervalMs = 60 * 1000; // 1 minute

  /**
   * Checks if an action is permitted under the specified threshold.
   *
   * @param key Unique rate limiting key (e.g. `login:127.0.0.1` or `register:127.0.0.1`)
   * @param limit Maximum allowed attempts within the window
   * @param windowMs Window duration in milliseconds
   */
  check(key: string, limit: number, windowMs: number): RateLimitResult {
    this.maybeCleanup(windowMs);

    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Filter out timestamps outside the active window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= limit) {
      const oldestInWindow = entry.timestamps[0] || now;
      const resetTimeMs = oldestInWindow + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      resetTimeMs: now + windowMs,
    };
  }

  /**
   * Records an attempt timestamp for the specified key.
   */
  hit(key: string, windowMs: number): void {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }
    entry.timestamps.push(now);
    // Prune stale timestamps
    entry.timestamps = entry.timestamps.filter((ts) => ts > now - windowMs);
  }

  /**
   * Resets rate limit for a key upon successful action (e.g. successful login).
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clears entire rate limiting store (useful for test suites).
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Periodically prunes expired records to prevent unbounded memory growth.
   */
  private maybeCleanup(maxWindowMs: number): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupIntervalMs) {
      return;
    }
    this.lastCleanup = now;

    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > now - maxWindowMs);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Global singleton instances for authentication endpoints
export const authRateLimiter = new InMemoryRateLimiter();
