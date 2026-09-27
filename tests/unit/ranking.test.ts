import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

// Deterministic comparator matching ResultsService implementation
function compareRankedItems(
  a: { finalScore: Prisma.Decimal; rawAggregate: Prisma.Decimal; variance: Prisma.Decimal; submissionId: string },
  b: { finalScore: Prisma.Decimal; rawAggregate: Prisma.Decimal; variance: Prisma.Decimal; submissionId: string }
): number {
  // 1. finalScore (desc)
  if (!a.finalScore.equals(b.finalScore)) {
    return b.finalScore.minus(a.finalScore).toNumber();
  }
  // 2. rawAggregate (desc)
  if (!a.rawAggregate.equals(b.rawAggregate)) {
    return b.rawAggregate.minus(a.rawAggregate).toNumber();
  }
  // 3. variance (asc — lower variance means higher consensus among judges)
  if (!a.variance.equals(b.variance)) {
    return a.variance.minus(b.variance).toNumber();
  }
  // 4. submissionId (stable tie-breaker asc)
  return a.submissionId.localeCompare(b.submissionId);
}

describe("Deterministic Ranking & Multi-Tier Tie-Breaking Hierarchy", () => {
  it("ranks projects by finalScore in descending order (Tier 1)", () => {
    const p1 = {
      submissionId: "sub_1",
      finalScore: new Prisma.Decimal(92.5),
      rawAggregate: new Prisma.Decimal(85),
      variance: new Prisma.Decimal(2.0),
    };
    const p2 = {
      submissionId: "sub_2",
      finalScore: new Prisma.Decimal(95.0),
      rawAggregate: new Prisma.Decimal(80),
      variance: new Prisma.Decimal(4.0),
    };

    const list = [p1, p2].sort(compareRankedItems);

    expect(list[0]?.submissionId).toBe("sub_2");
    expect(list[1]?.submissionId).toBe("sub_1");
  });

  it("breaks ties with rawAggregateScore (Tier 2) when finalScores are identical", () => {
    const p1 = {
      submissionId: "sub_1",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(88.0),
      variance: new Prisma.Decimal(2.0),
    };
    const p2 = {
      submissionId: "sub_2",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(89.5),
      variance: new Prisma.Decimal(2.0),
    };

    const list = [p1, p2].sort(compareRankedItems);

    // sub_2 has higher rawAggregateScore (89.5 vs 88.0)
    expect(list[0]?.submissionId).toBe("sub_2");
    expect(list[1]?.submissionId).toBe("sub_1");
  });

  it("breaks ties with judge consensus / variance (Tier 3) when finalScore and rawScore are equal", () => {
    const p1 = {
      submissionId: "sub_1",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(88.0),
      variance: new Prisma.Decimal(1.2), // lower variance = higher consensus
    };
    const p2 = {
      submissionId: "sub_2",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(88.0),
      variance: new Prisma.Decimal(5.8), // higher variance = divided judges
    };

    const list = [p1, p2].sort(compareRankedItems);

    // sub_1 has lower variance (higher agreement among judges)
    expect(list[0]?.submissionId).toBe("sub_1");
    expect(list[1]?.submissionId).toBe("sub_2");
  });

  it("breaks ties lexicographically by submissionId (Tier 4) when all scores and variance are identical", () => {
    const pB = {
      submissionId: "sub_bbb",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(88.0),
      variance: new Prisma.Decimal(2.0),
    };
    const pA = {
      submissionId: "sub_aaa",
      finalScore: new Prisma.Decimal(90.0),
      rawAggregate: new Prisma.Decimal(88.0),
      variance: new Prisma.Decimal(2.0),
    };

    const list = [pB, pA].sort(compareRankedItems);

    // sub_aaa comes before sub_bbb lexicographically
    expect(list[0]?.submissionId).toBe("sub_aaa");
    expect(list[1]?.submissionId).toBe("sub_bbb");
  });
});
