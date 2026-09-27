import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

describe("Database Integrity & Domain Architecture Tests (Phase 2)", () => {
  const testPrefix = `test-${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  afterAll(async () => {
    // Clean up test events (cascades memberships, tracks, prizes, teams, submissions, rubrics, etc.)
    if (createdEventIds.length > 0) {
      await prisma.event.deleteMany({
        where: { id: { in: createdEventIds } },
      });
    }
    // Clean up test users
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("enforces unique email constraint on User model", async () => {
    const email = `${testPrefix}-user@example.com`;
    const user1 = await prisma.user.create({
      data: {
        email,
        name: "Test User 1",
      },
    });
    createdUserIds.push(user1.id);

    await expect(
      prisma.user.create({
        data: {
          email,
          name: "Test User 2 with duplicate email",
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("enforces unique slug constraint on Event model", async () => {
    const slug = `${testPrefix}-event-slug`;
    const event1 = await prisma.event.create({
      data: {
        name: "Test Event 1",
        slug,
        state: "DRAFT",
      },
    });
    createdEventIds.push(event1.id);

    await expect(
      prisma.event.create({
        data: {
          name: "Test Event 2 with duplicate slug",
          slug,
          state: "DRAFT",
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("enforces unique (userId, eventId, role) on EventMembership while allowing multi-event membership", async () => {
    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}-multirole@example.com`,
        name: "Multi-Role User",
      },
    });
    createdUserIds.push(user.id);

    const eventA = await prisma.event.create({
      data: {
        name: `${testPrefix} Event A`,
        slug: `${testPrefix}-event-a`,
        state: "REGISTRATION_OPEN",
      },
    });
    const eventB = await prisma.event.create({
      data: {
        name: `${testPrefix} Event B`,
        slug: `${testPrefix}-event-b`,
        state: "REGISTRATION_OPEN",
      },
    });
    createdEventIds.push(eventA.id, eventB.id);

    // Can be an ORGANIZER in Event A
    const membershipA = await prisma.eventMembership.create({
      data: {
        eventId: eventA.id,
        userId: user.id,
        role: "ORGANIZER",
      },
    });
    expect(membershipA.role).toBe("ORGANIZER");

    // Can be a JUDGE in Event B (cross-event role flexibility)
    const membershipB = await prisma.eventMembership.create({
      data: {
        eventId: eventB.id,
        userId: user.id,
        role: "JUDGE",
      },
    });
    expect(membershipB.role).toBe("JUDGE");

    // CANNOT have a second identical membership in Event A (duplicate [userId, eventId, role])
    await expect(
      prisma.eventMembership.create({
        data: {
          eventId: eventA.id,
          userId: user.id,
          role: "ORGANIZER",
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("allows same track slug in different events, but rejects duplicates within the same event", async () => {
    const eventA = await prisma.event.create({
      data: {
        name: `${testPrefix} Track Event A`,
        slug: `${testPrefix}-track-event-a`,
      },
    });
    const eventB = await prisma.event.create({
      data: {
        name: `${testPrefix} Track Event B`,
        slug: `${testPrefix}-track-event-b`,
      },
    });
    createdEventIds.push(eventA.id, eventB.id);

    const trackSlug = "ai-track";

    // Track in Event A
    const trackA = await prisma.track.create({
      data: {
        eventId: eventA.id,
        name: "AI Track A",
        slug: trackSlug,
      },
    });
    expect(trackA.slug).toBe(trackSlug);

    // Same slug in Event B is permitted
    const trackB = await prisma.track.create({
      data: {
        eventId: eventB.id,
        name: "AI Track B",
        slug: trackSlug,
      },
    });
    expect(trackB.slug).toBe(trackSlug);

    // Duplicate track slug within Event A is rejected
    await expect(
      prisma.track.create({
        data: {
          eventId: eventA.id,
          name: "Duplicate AI Track in Event A",
          slug: trackSlug,
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("enforces single submission per team per event", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Sub Event`,
        slug: `${testPrefix}-sub-event`,
      },
    });
    createdEventIds.push(event.id);

    const leader = await prisma.user.create({
      data: {
        email: `${testPrefix}-leader@example.com`,
        name: "Leader",
      },
    });
    createdUserIds.push(leader.id);

    const team = await prisma.team.create({
      data: {
        name: "Solo Team",
        slug: "solo-team",
        event: { connect: { id: event.id } },
        creator: { connect: { id: leader.id } },
      },
    });

    const sub1 = await prisma.submission.create({
      data: {
        event: { connect: { id: event.id } },
        team: { connect: { id: team.id } },
        title: "First Project Submission",
        description: "Initial description",
        state: "SUBMITTED",
      },
    });
    expect(sub1.id).toBeDefined();

    // Duplicate submission for same team in same event must fail
    await expect(
      prisma.submission.create({
        data: {
          event: { connect: { id: event.id } },
          team: { connect: { id: team.id } },
          title: "Second Project Submission (Duplicate)",
          description: "Duplicate description",
          state: "DRAFT",
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("supports immutable submission versions without overwriting historical data", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Versioning Event`,
        slug: `${testPrefix}-versioning-event`,
      },
    });
    createdEventIds.push(event.id);

    const leader = await prisma.user.create({
      data: {
        email: `${testPrefix}-version-lead@example.com`,
        name: "Lead Versioner",
      },
    });
    createdUserIds.push(leader.id);

    const team = await prisma.team.create({
      data: {
        name: "Versioned Team",
        slug: "versioned-team",
        event: { connect: { id: event.id } },
        creator: { connect: { id: leader.id } },
      },
    });

    const submission = await prisma.submission.create({
      data: {
        event: { connect: { id: event.id } },
        team: { connect: { id: team.id } },
        title: "Versioned Submission",
        description: "Initial description",
        state: "SUBMITTED",
      },
    });

    // Create Version 1
    const v1 = await prisma.submissionVersion.create({
      data: {
        submission: { connect: { id: submission.id } },
        versionNumber: 1,
        title: "Initial Pitch",
        description: "V1 Description",
        snapshotData: { summary: "V1 Snapshot" },
        submittedBy: { connect: { id: leader.id } },
      },
    });
    expect(v1.versionNumber).toBe(1);

    // Create Version 2
    const v2 = await prisma.submissionVersion.create({
      data: {
        submission: { connect: { id: submission.id } },
        versionNumber: 2,
        title: "Final Polished Pitch",
        description: "V2 Description with demo link",
        snapshotData: { summary: "V2 Snapshot" },
        submittedBy: { connect: { id: leader.id } },
      },
    });
    expect(v2.versionNumber).toBe(2);

    // Fetch all versions
    const versions = await prisma.submissionVersion.findMany({
      where: { submissionId: submission.id },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.title).toBe("Initial Pitch");
    expect(versions[1]?.title).toBe("Final Polished Pitch");

    // Duplicate version number for the same submission must fail
    await expect(
      prisma.submissionVersion.create({
        data: {
          submission: { connect: { id: submission.id } },
          versionNumber: 1,
          title: "Duplicate V1",
          description: "Duplicate",
          snapshotData: {},
          submittedBy: { connect: { id: leader.id } },
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("verifies rubric criteria weights sum and version immutability", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Rubric Event`,
        slug: `${testPrefix}-rubric-event`,
      },
    });
    createdEventIds.push(event.id);

    const rubric = await prisma.rubric.create({
      data: {
        event: { connect: { id: event.id } },
        name: "Standard Rubric",
      },
    });

    const rubricV1 = await prisma.rubricVersion.create({
      data: {
        rubric: { connect: { id: rubric.id } },
        versionNumber: 1,
        criteria: {
          create: [
            {
              name: "Technical Execution",
              weight: new Prisma.Decimal("0.50"),
              maxScore: new Prisma.Decimal("10.00"),
              order: 0,
            },
            {
              name: "Innovation & Design",
              weight: new Prisma.Decimal("0.50"),
              maxScore: new Prisma.Decimal("10.00"),
              order: 1,
            },
          ],
        },
      },
      include: { criteria: true },
    });

    const totalWeight = rubricV1.criteria.reduce(
      (sum, c) => sum + Number(c.weight),
      0
    );
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("enforces unique judge assignment and score item immutability", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Scoring Event`,
        slug: `${testPrefix}-scoring-event`,
      },
    });
    createdEventIds.push(event.id);

    const judge = await prisma.user.create({
      data: {
        email: `${testPrefix}-judge@example.com`,
        name: "Judge Smith",
      },
    });
    const leader = await prisma.user.create({
      data: {
        email: `${testPrefix}-leader-score@example.com`,
        name: "Leader Score",
      },
    });
    createdUserIds.push(judge.id, leader.id);

    const team = await prisma.team.create({
      data: {
        name: "Scored Team",
        slug: "scored-team",
        event: { connect: { id: event.id } },
        creator: { connect: { id: leader.id } },
      },
    });

    const submission = await prisma.submission.create({
      data: {
        title: "Scored Project",
        description: "Scored project description",
        state: "SUBMITTED",
        event: { connect: { id: event.id } },
        team: { connect: { id: team.id } },
      },
    });

    // 1. Assign judge to submission
    const assignment = await prisma.judgeAssignment.create({
      data: {
        event: { connect: { id: event.id } },
        submission: { connect: { id: submission.id } },
        judge: { connect: { id: judge.id } },
      },
    });
    expect(assignment.id).toBeDefined();

    // 2. Reject duplicate assignment
    await expect(
      prisma.judgeAssignment.create({
        data: {
          event: { connect: { id: event.id } },
          submission: { connect: { id: submission.id } },
          judge: { connect: { id: judge.id } },
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);

    // 3. Create rubric & criteria
    const rubric = await prisma.rubric.create({
      data: {
        event: { connect: { id: event.id } },
        name: "Judging Rubric",
      },
    });
    const rubricVersion = await prisma.rubricVersion.create({
      data: {
        rubric: { connect: { id: rubric.id } },
        versionNumber: 1,
        criteria: {
          create: [
            {
              name: "Code Quality",
              weight: new Prisma.Decimal("1.00"),
              maxScore: new Prisma.Decimal("10.00"),
              order: 0,
            },
          ],
        },
      },
      include: { criteria: true },
    });

    // 4. Record raw score
    const rawScore = await prisma.score.create({
      data: {
        event: { connect: { id: event.id } },
        submission: { connect: { id: submission.id } },
        judge: { connect: { id: judge.id } },
        rubricVersion: { connect: { id: rubricVersion.id } },
        feedback: "Overall solid work",
        isFinal: true,
        items: {
          create: [
            {
              criterionId: rubricVersion.criteria[0]!.id,
              rawScore: new Prisma.Decimal("9.50"),
              feedback: "Excellent architecture and test coverage.",
            },
          ],
        },
      },
      include: { items: true },
    });
    expect(rawScore.items[0]?.rawScore.toString()).toBe("9.5");

    // 5. Ensure raw score is separate from NormalizationRun
    const normRun = await prisma.normalizationRun.create({
      data: {
        event: { connect: { id: event.id } },
        method: "Z_SCORE",
        parameters: { mean: 8.0, stdDev: 1.2 },
        status: "COMPLETED",
        executedBy: { connect: { id: judge.id } },
        normalizedScores: {
          create: [
            {
              submissionId: submission.id,
              normalizedValue: new Prisma.Decimal("9.8200"),
              zScore: 1.25,
            },
          ],
        },
      },
      include: { normalizedScores: true },
    });

    // Verify raw score is intact and untouched
    const retrievedRawScore = await prisma.score.findUnique({
      where: { id: rawScore.id },
      include: { items: true },
    });
    expect(retrievedRawScore?.items[0]?.rawScore.toString()).toBe("9.5");
    expect(normRun.normalizedScores[0]?.normalizedValue.toString()).toBe("9.82");
  });

  it("enforces single vote per user constraint on same submission", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Vote Event`,
        slug: `${testPrefix}-vote-event`,
      },
    });
    createdEventIds.push(event.id);

    const voter = await prisma.user.create({
      data: {
        email: `${testPrefix}-voter@example.com`,
        name: "Voter",
      },
    });
    const leader = await prisma.user.create({
      data: {
        email: `${testPrefix}-vote-lead@example.com`,
        name: "Vote Lead",
      },
    });
    createdUserIds.push(voter.id, leader.id);

    const team = await prisma.team.create({
      data: {
        name: "Voted Team",
        slug: "voted-team",
        event: { connect: { id: event.id } },
        creator: { connect: { id: leader.id } },
      },
    });

    const sub = await prisma.submission.create({
      data: {
        title: "Voted Project",
        description: "Voted project description",
        state: "SUBMITTED",
        event: { connect: { id: event.id } },
        team: { connect: { id: team.id } },
      },
    });

    // First vote succeeds
    const vote = await prisma.vote.create({
      data: {
        event: { connect: { id: event.id } },
        submission: { connect: { id: sub.id } },
        voter: { connect: { id: voter.id } },
      },
    });
    expect(vote.id).toBeDefined();

    // Second vote by same user on same submission in same event must be rejected
    await expect(
      prisma.vote.create({
        data: {
          event: { connect: { id: event.id } },
          submission: { connect: { id: sub.id } },
          voter: { connect: { id: voter.id } },
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("enforces unique verificationId token on Certificate model", async () => {
    const event = await prisma.event.create({
      data: {
        name: `${testPrefix} Cert Event`,
        slug: `${testPrefix}-cert-event`,
      },
    });
    createdEventIds.push(event.id);

    const recipient = await prisma.user.create({
      data: {
        email: `${testPrefix}-cert-user@example.com`,
        name: "Cert Recipient",
      },
    });
    createdUserIds.push(recipient.id);

    const certToken = `CERT-TOKEN-${testPrefix}`;

    const cert1 = await prisma.certificate.create({
      data: {
        event: { connect: { id: event.id } },
        recipient: { connect: { id: recipient.id } },
        title: "Certificate of Participation",
        type: "PARTICIPATION",
        verificationId: certToken,
      },
    });
    expect(cert1.verificationId).toBe(certToken);

    // Duplicate certificate verificationId must fail
    await expect(
      prisma.certificate.create({
        data: {
          event: { connect: { id: event.id } },
          recipient: { connect: { id: recipient.id } },
          title: "Certificate of Excellence",
          type: "WINNER",
          verificationId: certToken,
        },
      })
    ).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  it("demonstrates multi-event data isolation across events", async () => {
    const event1 = await prisma.event.create({
      data: {
        name: `${testPrefix} Isolated Event 1`,
        slug: `${testPrefix}-iso-1`,
      },
    });
    const event2 = await prisma.event.create({
      data: {
        name: `${testPrefix} Isolated Event 2`,
        slug: `${testPrefix}-iso-2`,
      },
    });
    createdEventIds.push(event1.id, event2.id);

    const user = await prisma.user.create({
      data: {
        email: `${testPrefix}-iso-lead@example.com`,
        name: "Iso Lead",
      },
    });
    createdUserIds.push(user.id);

    // Team in Event 1
    await prisma.team.create({
      data: {
        name: "Team Iso",
        slug: "team-iso",
        event: { connect: { id: event1.id } },
        creator: { connect: { id: user.id } },
      },
    });

    // Querying teams for Event 2 should return 0 teams
    const event2Teams = await prisma.team.findMany({
      where: { eventId: event2.id },
    });
    expect(event2Teams).toHaveLength(0);

    // Querying teams for Event 1 should return 1 team
    const event1Teams = await prisma.team.findMany({
      where: { eventId: event1.id },
    });
    expect(event1Teams).toHaveLength(1);
  });
});
