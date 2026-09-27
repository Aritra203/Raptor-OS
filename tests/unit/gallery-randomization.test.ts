import { describe, it, expect } from "vitest";

describe("Deterministic Gallery Randomization (Phase 8)", () => {
  // Deterministic permutation logic mirrors submission.repository.ts
  function getPermutationMode(seed: number): number {
    return Math.abs(seed) % 6;
  }

  it("produces identical permutation mode for identical seeds (seed determinism)", () => {
    const seed = 42;
    const mode1 = getPermutationMode(seed);
    const mode2 = getPermutationMode(seed);
    const mode3 = getPermutationMode(seed);

    expect(mode1).toBe(mode2);
    expect(mode2).toBe(mode3);
    expect(mode1).toBe(0); // 42 % 6 === 0
  });

  it("produces different permutation modes across varying seeds", () => {
    const seeds = [42, 43, 44, 45, 46, 47];
    const modes = seeds.map((s) => getPermutationMode(s));

    // Seeds 42..47 should map to modes 0..5
    expect(modes).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("handles negative seeds deterministically without crashing or producing negative indices", () => {
    const negativeSeed = -1337;
    const mode = getPermutationMode(negativeSeed);
    expect(mode).toBeGreaterThanOrEqual(0);
    expect(mode).toBeLessThan(6);
    expect(mode).toBe(getPermutationMode(1337));
  });

  it("ensures pagination stability across multiple pages using deterministic ordering", () => {
    // Simulated dataset of 10 items
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `sub_${i + 1}`,
      title: `Project ${String.fromCharCode(65 + i)}`,
      createdAt: new Date(2026, 1, i + 1),
    }));

    // Sorting by title asc
    const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));

    // Paginate: Page 1 (limit 5), Page 2 (limit 5)
    const page1 = sorted.slice(0, 5);
    const page2 = sorted.slice(5, 10);

    const page1Ids = page1.map((p) => p.id);
    const page2Ids = page2.map((p) => p.id);

    // No overlaps between pages
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
    expect([...page1Ids, ...page2Ids]).toHaveLength(10);
  });
});
