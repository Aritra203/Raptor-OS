import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient, EventState, EventRole, MembershipStatus, TeamMemberRole, InvitationStatus, SubmissionState, AssignmentStatus, RunStatus, CertificateType, VotingEligibilityMode, CommentModerationStatus, AbuseSignalStatus, AbuseSignalSeverity } from "@prisma/client";
import { hashPassword } from "../server/auth/password";

const prisma = new PrismaClient();

const INITIAL_SETTINGS = [
  {
    key: "platform.initialized",
    value: "true",
    description: "Indicates whether RaptorOS foundation has been initialized",
  },
  {
    key: "platform.version",
    value: "0.6.0-phase6",
    description: "Current platform version",
  },
  {
    key: "platform.mode",
    value: "offline-ready",
    description: "Operating mode for RaptorOS self-hosted instance",
  },
  {
    key: "platform.name",
    value: "RaptorOS",
    description: "Platform brand name",
  },
];

async function main(): Promise<void> {
  console.info("Starting deterministic database seed (Phase 4)...");

  // 1. System Settings
  for (const setting of INITIAL_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: { key: setting.key, value: setting.value, description: setting.description },
    });
  }
  console.info("  [SEED] Configured system settings.");

  // 2. Users (Deterministic IDs with known development fixture passwords)
  // WARNING: Fixture credentials for development and testing only!
  const FIXTURE_PASSWORD = "TestPassword123!";
  const fixturePasswordHash = await hashPassword(FIXTURE_PASSWORD);

  const users = [
    { id: "usr_admin_1", email: "admin@raptoros.internal", name: "Alice Admin", bio: "Platform Administrator" },
    { id: "usr_org_1", email: "organizer.bob@raptoros.internal", name: "Bob Organizer", bio: "Lead Event Organizer" },
    { id: "usr_judge_1", email: "judge.clara@raptoros.internal", name: "Dr. Clara Judge", bio: "AI & Distributed Systems Expert" },
    { id: "usr_judge_2", email: "judge.david@raptoros.internal", name: "David Evaluator", bio: "Senior Software Architect" },
    { id: "usr_judge_3", email: "judge.marcus@raptoros.internal", name: "Marcus Evaluator", bio: "Security & Cryptography Specialist" },
    { id: "usr_part_1", email: "hacker.elena@raptoros.internal", name: "Elena Builder", bio: "Full-stack hacker & ML engineer" },
    { id: "usr_part_2", email: "hacker.frank@raptoros.internal", name: "Frank Coder", bio: "Rustacean and Systems Programmer" },
    { id: "usr_part_3", email: "hacker.grace@raptoros.internal", name: "Grace Dev", bio: "Frontend & UX Specialist" },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, bio: u.bio, passwordHash: fixturePasswordHash },
      create: { id: u.id, email: u.email, name: u.name, bio: u.bio, passwordHash: fixturePasswordHash },
    });
  }
  console.info("  [SEED] Configured 7 users with secure fixture passwords.");

  // 3. Events (Multi-Event isolation: Event 1 = Ongoing, Event 2 = Completed)
  const event1 = await prisma.event.upsert({
    where: { id: "evt_raptor_2026" },
    update: {
      name: "Raptor Hack 2026",
      slug: "raptor-hack-2026",
      state: EventState.JUDGING_OPEN,
      description: "Premier offline-first annual hackathon.",
      timezone: "UTC",
    },
    create: {
      id: "evt_raptor_2026",
      name: "Raptor Hack 2026",
      slug: "raptor-hack-2026",
      state: EventState.JUDGING_OPEN,
      description: "Premier offline-first annual hackathon.",
      timezone: "UTC",
      registrationStart: new Date("2026-01-01T00:00:00Z"),
      registrationEnd: new Date("2026-02-01T00:00:00Z"),
      submissionsStart: new Date("2026-02-01T00:00:00Z"),
      submissionsEnd: new Date("2026-02-15T00:00:00Z"),
      judgingStart: new Date("2026-02-15T00:00:00Z"),
      judgingEnd: new Date("2026-02-20T00:00:00Z"),
      startsAt: new Date("2026-02-01T00:00:00Z"),
      endsAt: new Date("2026-02-22T00:00:00Z"),
    },
  });

  const event2 = await prisma.event.upsert({
    where: { id: "evt_global_ai_2026" },
    update: {
      name: "Global AI Sprint",
      slug: "global-ai-sprint",
      state: EventState.RESULTS_PUBLISHED,
      description: "Autonomous agents and intelligent systems sprint.",
      timezone: "UTC",
    },
    create: {
      id: "evt_global_ai_2026",
      name: "Global AI Sprint",
      slug: "global-ai-sprint",
      state: EventState.RESULTS_PUBLISHED,
      description: "Autonomous agents and intelligent systems sprint.",
      timezone: "UTC",
      registrationStart: new Date("2026-01-10T00:00:00Z"),
      registrationEnd: new Date("2026-01-20T00:00:00Z"),
      submissionsStart: new Date("2026-01-20T00:00:00Z"),
      submissionsEnd: new Date("2026-01-25T00:00:00Z"),
      judgingStart: new Date("2026-01-25T00:00:00Z"),
      judgingEnd: new Date("2026-01-28T00:00:00Z"),
      startsAt: new Date("2026-01-20T00:00:00Z"),
      endsAt: new Date("2026-01-30T00:00:00Z"),
    },
  });
  const event3 = await prisma.event.upsert({
    where: { id: "evt_winter_code_2026" },
    update: {
      name: "Winter Hackathon 2026",
      slug: "winter-hackathon-2026",
      state: EventState.REGISTRATION_OPEN,
      description: "Open registration for all local and distributed teams.",
      timezone: "UTC",
      minTeamSize: 1,
      maxTeamSize: 4,
    },
    create: {
      id: "evt_winter_code_2026",
      name: "Winter Hackathon 2026",
      slug: "winter-hackathon-2026",
      state: EventState.REGISTRATION_OPEN,
      description: "Open registration for all local and distributed teams.",
      timezone: "UTC",
      registrationStart: new Date("2026-01-01T00:00:00Z"),
      registrationEnd: new Date("2026-12-31T23:59:59Z"),
      submissionsStart: new Date("2026-11-01T00:00:00Z"),
      submissionsEnd: new Date("2026-12-31T23:59:59Z"),
      startsAt: new Date("2026-11-01T00:00:00Z"),
      endsAt: new Date("2026-12-31T23:59:59Z"),
      minTeamSize: 1,
      maxTeamSize: 4,
    },
  });

  const event4 = await prisma.event.upsert({
    where: { id: "evt_draft_hack_2026" },
    update: {
      name: "Internal Security Sprint",
      slug: "internal-security-sprint",
      state: EventState.DRAFT,
      description: "Draft cybersecurity hackathon for organizer planning.",
      timezone: "UTC",
    },
    create: {
      id: "evt_draft_hack_2026",
      name: "Internal Security Sprint",
      slug: "internal-security-sprint",
      state: EventState.DRAFT,
      description: "Draft cybersecurity hackathon for organizer planning.",
      timezone: "UTC",
      minTeamSize: 1,
      maxTeamSize: 3,
    },
  });
  console.info("  [SEED] Configured 4 events across various lifecycle states.");

  // 4. Event Memberships (Demonstrating event-scoped roles)
  const memberships = [
    // Event 1 Roles
    { userId: "usr_admin_1", eventId: event1.id, role: EventRole.ADMIN },
    { userId: "usr_org_1", eventId: event1.id, role: EventRole.ORGANIZER },
    { userId: "usr_judge_1", eventId: event1.id, role: EventRole.JUDGE },
    { userId: "usr_judge_2", eventId: event1.id, role: EventRole.JUDGE },
    { userId: "usr_judge_3", eventId: event1.id, role: EventRole.JUDGE },
    { userId: "usr_part_1", eventId: event1.id, role: EventRole.PARTICIPANT },
    { userId: "usr_part_2", eventId: event1.id, role: EventRole.PARTICIPANT },
    { userId: "usr_part_3", eventId: event1.id, role: EventRole.PARTICIPANT },
    // Event 2 Roles: User Bob who was organizer in Event 1 is a Judge in Event 2!
    { userId: "usr_org_1", eventId: event2.id, role: EventRole.JUDGE },
    { userId: "usr_part_1", eventId: event2.id, role: EventRole.PARTICIPANT },
    // Event 3 (REGISTRATION_OPEN): Bob is Organizer, Elena & Frank are registered Participants
    { userId: "usr_org_1", eventId: event3.id, role: EventRole.ORGANIZER },
    { userId: "usr_part_1", eventId: event3.id, role: EventRole.PARTICIPANT },
    { userId: "usr_part_2", eventId: event3.id, role: EventRole.PARTICIPANT },
    // Event 4 (DRAFT): Alice is Organizer
    { userId: "usr_admin_1", eventId: event4.id, role: EventRole.ORGANIZER },
  ];

  for (const m of memberships) {
    await prisma.eventMembership.upsert({
      where: { userId_eventId_role: { userId: m.userId, eventId: m.eventId, role: m.role } },
      update: { status: MembershipStatus.ACTIVE },
      create: { userId: m.userId, eventId: m.eventId, role: m.role, status: MembershipStatus.ACTIVE },
    });
  }
  console.info("  [SEED] Configured event memberships with cross-event roles.");

  // 5. Tracks
  const track1 = await prisma.track.upsert({
    where: { eventId_slug: { eventId: event1.id, slug: "ai-agents" } },
    update: { name: "AI & Autonomous Agents", description: "Offline LLMs and reasoning engines." },
    create: {
      id: "trk_ai_1",
      eventId: event1.id,
      name: "AI & Autonomous Agents",
      slug: "ai-agents",
      description: "Offline LLMs and reasoning engines.",
      order: 1,
    },
  });

  const _track2 = await prisma.track.upsert({
    where: { eventId_slug: { eventId: event1.id, slug: "dev-tools" } },
    update: { name: "Developer Tooling", description: "Developer infrastructure, CLIs, and compilers." },
    create: {
      id: "trk_dev_1",
      eventId: event1.id,
      name: "Developer Tooling",
      slug: "dev-tools",
      description: "Developer infrastructure, CLIs, and compilers.",
      order: 2,
    },
  });
  console.info("  [SEED] Configured tracks.");

  // 6. Prizes
  const prize1 = await prisma.prize.upsert({
    where: { id: "prz_grand_1" },
    update: { name: "Overall Grand Prize", value: 10000.0 },
    create: {
      id: "prz_grand_1",
      eventId: event1.id,
      name: "Overall Grand Prize",
      description: "Best project across all tracks.",
      value: 10000.0,
      order: 1,
    },
  });

  await prisma.prize.upsert({
    where: { id: "prz_ai_best" },
    update: { name: "Best AI Agent Award", value: 3000.0 },
    create: {
      id: "prz_ai_best",
      eventId: event1.id,
      trackId: track1.id,
      name: "Best AI Agent Award",
      description: "Highest scoring project in AI track.",
      value: 3000.0,
      order: 2,
    },
  });
  console.info("  [SEED] Configured prizes.");

  // 7. Teams & Team Members
  const team1 = await prisma.team.upsert({
    where: { eventId_slug: { eventId: event1.id, slug: "team-raptor-core" } },
    update: { name: "Raptor Core" },
    create: {
      id: "team_raptor_core",
      eventId: event1.id,
      trackId: track1.id,
      creatorId: "usr_part_1",
      name: "Raptor Core",
      slug: "team-raptor-core",
      description: "Building autonomous systems for competitions.",
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team1.id, userId: "usr_part_1" } },
    update: { role: TeamMemberRole.LEADER },
    create: { teamId: team1.id, userId: "usr_part_1", role: TeamMemberRole.LEADER },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team1.id, userId: "usr_part_2" } },
    update: { role: TeamMemberRole.MEMBER },
    create: { teamId: team1.id, userId: "usr_part_2", role: TeamMemberRole.MEMBER },
  });

  await prisma.teamInvitation.upsert({
    where: { teamId_email: { teamId: team1.id, email: "invitee@raptoros.internal" } },
    update: { status: InvitationStatus.PENDING },
    create: {
      teamId: team1.id,
      email: "invitee@raptoros.internal",
      token: "inv_token_secure_99182",
      status: InvitationStatus.PENDING,
      expiresAt: new Date("2026-03-01T00:00:00Z"),
    },
  });

  await prisma.teamInvitation.upsert({
    where: { teamId_email: { teamId: team1.id, email: "hacker.grace@raptoros.internal" } },
    update: { status: InvitationStatus.PENDING },
    create: {
      teamId: team1.id,
      email: "hacker.grace@raptoros.internal",
      token: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      status: InvitationStatus.PENDING,
      expiresAt: new Date("2026-12-31T23:59:59Z"),
    },
  });

  // Team 2 (Event 1 - Disqualified project fixture)
  const team2 = await prisma.team.upsert({
    where: { eventId_slug: { eventId: event1.id, slug: "team-shadow-protocol" } },
    update: { name: "Shadow Protocol" },
    create: {
      id: "team_shadow",
      eventId: event1.id,
      trackId: _track2.id,
      creatorId: "usr_part_3",
      name: "Shadow Protocol",
      slug: "team-shadow-protocol",
      description: "Exploring dark routing and clandestine packet relays.",
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team2.id, userId: "usr_part_3" } },
    update: { role: TeamMemberRole.LEADER },
    create: { teamId: team2.id, userId: "usr_part_3", role: TeamMemberRole.LEADER },
  });

  // Team 3 (Event 2 - Locked project fixture)
  const team3 = await prisma.team.upsert({
    where: { eventId_slug: { eventId: event2.id, slug: "team-omniagent" } },
    update: { name: "OmniAgent Labs" },
    create: {
      id: "team_global_ai",
      eventId: event2.id,
      creatorId: "usr_part_1",
      name: "OmniAgent Labs",
      slug: "team-omniagent",
      description: "Autonomous reasoning and tool synthesis agents.",
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team3.id, userId: "usr_part_1" } },
    update: { role: TeamMemberRole.LEADER },
    create: { teamId: team3.id, userId: "usr_part_1", role: TeamMemberRole.LEADER },
  });

  // Team 4 (Event 3 - Draft project fixture)
  const team4 = await prisma.team.upsert({
    where: { eventId_slug: { eventId: event3.id, slug: "team-frostbyte" } },
    update: { name: "FrostByte Systems" },
    create: {
      id: "team_winter_hack",
      eventId: event3.id,
      creatorId: "usr_part_2",
      name: "FrostByte Systems",
      slug: "team-frostbyte",
      description: "Building zero-dependency low temperature storage.",
    },
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team4.id, userId: "usr_part_2" } },
    update: { role: TeamMemberRole.LEADER },
    create: { teamId: team4.id, userId: "usr_part_2", role: TeamMemberRole.LEADER },
  });

  console.info("  [SEED] Configured teams and invitations.");

  // 8. Submissions & Submission Versions (Covering all states: SUBMITTED, LOCKED, DISQUALIFIED, DRAFT)
  const submission1 = await prisma.submission.upsert({
    where: { id: "sub_mesh_1" },
    update: { title: "RaptorMesh: Decentralized Local Mesh Network" },
    create: {
      id: "sub_mesh_1",
      eventId: event1.id,
      teamId: team1.id,
      trackId: track1.id,
      title: "RaptorMesh: Decentralized Local Mesh Network",
      description: "An ad-hoc offline peer-to-peer communication matrix for disconnected venues.",
      repositoryUrl: "https://github.com/raptoros/raptormesh",
      demoUrl: "http://localhost:3000/demo/raptormesh",
      state: SubmissionState.SUBMITTED,
      submittedAt: new Date("2026-02-14T18:30:00Z"),
    },
  });

  await prisma.submissionVersion.upsert({
    where: { submissionId_versionNumber: { submissionId: submission1.id, versionNumber: 1 } },
    update: { title: submission1.title },
    create: {
      id: "subver_mesh_v1",
      submissionId: submission1.id,
      versionNumber: 1,
      title: submission1.title,
      description: submission1.description,
      repositoryUrl: submission1.repositoryUrl,
      demoUrl: submission1.demoUrl,
      snapshotData: {
        title: submission1.title,
        description: submission1.description,
        repo: submission1.repositoryUrl,
        teamMembers: ["usr_part_1", "usr_part_2"],
      },
      submittedById: "usr_part_1",
    },
  });

  const submissionDisq = await prisma.submission.upsert({
    where: { id: "sub_disq_1" },
    update: { title: "ShadowRoute: Dark Spectrum Relay" },
    create: {
      id: "sub_disq_1",
      eventId: event1.id,
      teamId: team2.id,
      trackId: _track2.id,
      title: "ShadowRoute: Dark Spectrum Relay",
      description: "Bypasses firewalls using unauthorized spectrum relays.",
      repositoryUrl: "https://github.com/raptoros/shadowroute",
      state: SubmissionState.DISQUALIFIED,
      customData: { disqualificationReason: "Unauthorized transmission frequencies detected." },
      submittedAt: new Date("2026-02-14T12:00:00Z"),
    },
  });

  await prisma.submissionVersion.upsert({
    where: { submissionId_versionNumber: { submissionId: submissionDisq.id, versionNumber: 1 } },
    update: { title: submissionDisq.title },
    create: {
      id: "subver_disq_v1",
      submissionId: submissionDisq.id,
      versionNumber: 1,
      title: submissionDisq.title,
      description: submissionDisq.description,
      repositoryUrl: submissionDisq.repositoryUrl,
      snapshotData: {
        title: submissionDisq.title,
        description: submissionDisq.description,
      },
      submittedById: "usr_part_3",
    },
  });

  const submissionLocked = await prisma.submission.upsert({
    where: { id: "sub_locked_1" },
    update: { title: "OmniAgent: Self-Directed Orchestration" },
    create: {
      id: "sub_locked_1",
      eventId: event2.id,
      teamId: team3.id,
      title: "OmniAgent: Self-Directed Orchestration",
      description: "Autonomous reasoning agent capable of distributed consensus without connectivity.",
      repositoryUrl: "https://github.com/raptoros/omniagent",
      demoUrl: "https://omniagent.raptoros.internal",
      state: SubmissionState.LOCKED,
      submittedAt: new Date("2026-01-24T18:00:00Z"),
      lockedAt: new Date("2026-01-25T00:00:00Z"),
    },
  });

  await prisma.submissionVersion.upsert({
    where: { submissionId_versionNumber: { submissionId: submissionLocked.id, versionNumber: 1 } },
    update: { title: submissionLocked.title },
    create: {
      id: "subver_locked_v1",
      submissionId: submissionLocked.id,
      versionNumber: 1,
      title: submissionLocked.title,
      description: submissionLocked.description,
      repositoryUrl: submissionLocked.repositoryUrl,
      demoUrl: submissionLocked.demoUrl,
      snapshotData: {
        title: submissionLocked.title,
        description: submissionLocked.description,
      },
      submittedById: "usr_part_1",
    },
  });

  const submissionDraft = await prisma.submission.upsert({
    where: { id: "sub_draft_1" },
    update: { title: "CryoCache: Deterministic Storage Engine" },
    create: {
      id: "sub_draft_1",
      eventId: event3.id,
      teamId: team4.id,
      title: "CryoCache: Deterministic Storage Engine",
      description: "Ultra low-temperature offline persistent store designed for harsh environments.",
      repositoryUrl: "https://github.com/raptoros/cryocache",
      state: SubmissionState.DRAFT,
    },
  });

  await prisma.submissionVersion.upsert({
    where: { submissionId_versionNumber: { submissionId: submissionDraft.id, versionNumber: 1 } },
    update: { title: submissionDraft.title },
    create: {
      id: "subver_draft_v1",
      submissionId: submissionDraft.id,
      versionNumber: 1,
      title: submissionDraft.title,
      description: submissionDraft.description,
      repositoryUrl: submissionDraft.repositoryUrl,
      snapshotData: {
        title: submissionDraft.title,
        description: submissionDraft.description,
      },
      submittedById: "usr_part_2",
    },
  });
  console.info("  [SEED] Configured submissions and immutable versions.");

  // 9. Rubrics & Versioned Criteria (100% total weight)
  const rubric1 = await prisma.rubric.upsert({
    where: { id: "rub_standard_1" },
    update: { name: "Standard Evaluation Rubric" },
    create: {
      id: "rub_standard_1",
      eventId: event1.id,
      name: "Standard Evaluation Rubric",
      description: "Holistic evaluation across innovation, execution, and impact.",
    },
  });

  const rubricVersion1 = await prisma.rubricVersion.upsert({
    where: { rubricId_versionNumber: { rubricId: rubric1.id, versionNumber: 1 } },
    update: { isActive: true },
    create: {
      id: "rubver_std_v1",
      rubricId: rubric1.id,
      versionNumber: 1,
      isActive: true,
    },
  });

  const criteria = [
    { id: "crit_innov", name: "Technical Innovation", weight: 0.35, maxScore: 10.0, order: 1 },
    { id: "crit_exec", name: "Execution & Reliability", weight: 0.30, maxScore: 10.0, order: 2 },
    { id: "crit_impact", name: "Practical Impact", weight: 0.20, maxScore: 10.0, order: 3 },
    { id: "crit_design", name: "Design & UX", weight: 0.15, maxScore: 10.0, order: 4 },
  ];

  for (const c of criteria) {
    await prisma.rubricCriterion.upsert({
      where: { rubricVersionId_name: { rubricVersionId: rubricVersion1.id, name: c.name } },
      update: { weight: c.weight, maxScore: c.maxScore },
      create: {
        id: c.id,
        rubricVersionId: rubricVersion1.id,
        name: c.name,
        description: `Evaluation dimension for ${c.name}`,
        weight: c.weight,
        maxScore: c.maxScore,
        order: c.order,
      },
    });
  }
  console.info("  [SEED] Configured versioned rubrics (weights sum: 1.00 / 100%).");

  // 10. Assignment Batch & Judge Assignments
  const batch1 = await prisma.assignmentBatch.upsert({
    where: { id: "batch_seed_1" },
    update: { assignmentCount: 2 },
    create: {
      id: "batch_seed_1",
      eventId: event1.id,
      createdById: "usr_org_1",
      algorithm: "DETERMINISTIC_BALANCED",
      targetCoverage: 2,
      submissionCount: 1,
      judgeCount: 2,
      assignmentCount: 2,
      parameters: { targetJudgesPerSubmission: 2 },
      status: "COMPLETED",
    },
  });

  await prisma.judgeAssignment.upsert({
    where: { eventId_judgeId_submissionId: { eventId: event1.id, judgeId: "usr_judge_1", submissionId: submission1.id } },
    update: { status: AssignmentStatus.COMPLETED, batchId: batch1.id },
    create: {
      id: "asgn_judge1_sub1",
      eventId: event1.id,
      judgeId: "usr_judge_1",
      submissionId: submission1.id,
      batchId: batch1.id,
      status: AssignmentStatus.COMPLETED,
      completedAt: new Date("2026-02-16T14:00:00Z"),
    },
  });

  await prisma.judgeAssignment.upsert({
    where: { eventId_judgeId_submissionId: { eventId: event1.id, judgeId: "usr_judge_2", submissionId: submission1.id } },
    update: { status: AssignmentStatus.COMPLETED, batchId: batch1.id },
    create: {
      id: "asgn_judge2_sub1",
      eventId: event1.id,
      judgeId: "usr_judge_2",
      submissionId: submission1.id,
      batchId: batch1.id,
      status: AssignmentStatus.COMPLETED,
      completedAt: new Date("2026-02-16T14:30:00Z"),
    },
  });
  console.info("  [SEED] Configured judge assignments and assignment batch.");

  // 11. Raw Scores & Score Items
  const score1 = await prisma.score.upsert({
    where: { judgeId_submissionId_rubricVersionId: { judgeId: "usr_judge_1", submissionId: submission1.id, rubricVersionId: rubricVersion1.id } },
    update: { isFinal: true, feedback: "Exceptional architecture and offline resiliency." },
    create: {
      id: "score_j1_s1",
      eventId: event1.id,
      judgeId: "usr_judge_1",
      submissionId: submission1.id,
      rubricVersionId: rubricVersion1.id,
      feedback: "Exceptional architecture and offline resiliency.",
      isFinal: true,
    },
  });

  const scoresItemsData = [
    { criterionId: "crit_innov", rawScore: 9.5, feedback: "Novel offline mesh protocol." },
    { criterionId: "crit_exec", rawScore: 9.0, feedback: "Flawless local demo." },
    { criterionId: "crit_impact", rawScore: 8.5, feedback: "High utility in real competition environments." },
    { criterionId: "crit_design", rawScore: 8.0, feedback: "Clean technical interface." },
  ];

  for (const item of scoresItemsData) {
    await prisma.scoreItem.upsert({
      where: { scoreId_criterionId: { scoreId: score1.id, criterionId: item.criterionId } },
      update: { rawScore: item.rawScore, feedback: item.feedback },
      create: { scoreId: score1.id, criterionId: item.criterionId, rawScore: item.rawScore, feedback: item.feedback },
    });
  }

  const score2 = await prisma.score.upsert({
    where: { judgeId_submissionId_rubricVersionId: { judgeId: "usr_judge_2", submissionId: submission1.id, rubricVersionId: rubricVersion1.id } },
    update: { isFinal: true, feedback: "Solid offline protocol demonstration." },
    create: {
      id: "score_j2_s1",
      eventId: event1.id,
      judgeId: "usr_judge_2",
      submissionId: submission1.id,
      rubricVersionId: rubricVersion1.id,
      feedback: "Solid offline protocol demonstration.",
      isFinal: true,
    },
  });

  const scoresItemsData2 = [
    { criterionId: "crit_innov", rawScore: 8.5, feedback: "Strong protocol design." },
    { criterionId: "crit_exec", rawScore: 8.5, feedback: "Working binaries verified." },
    { criterionId: "crit_impact", rawScore: 8.0, feedback: "Direct offline utility." },
    { criterionId: "crit_design", rawScore: 8.5, feedback: "Functional UI." },
  ];

  for (const item of scoresItemsData2) {
    await prisma.scoreItem.upsert({
      where: { scoreId_criterionId: { scoreId: score2.id, criterionId: item.criterionId } },
      update: { rawScore: item.rawScore, feedback: item.feedback },
      create: { scoreId: score2.id, criterionId: item.criterionId, rawScore: item.rawScore, feedback: item.feedback },
    });
  }
  console.info("  [SEED] Configured immutable raw scores and score items.");

  // 12. Normalization Run & Normalized Scores
  const normRun = await prisma.normalizationRun.upsert({
    where: { id: "norm_run_001" },
    update: { status: RunStatus.COMPLETED },
    create: {
      id: "norm_run_001",
      eventId: event1.id,
      version: 1,
      method: "Z_SCORE",
      parameters: { outlierThreshold: 2.0 },
      metadata: { overallMean: "8.65", overallStdDev: "0.55" },
      status: RunStatus.COMPLETED,
      executedById: "usr_admin_1",
      inputScoreCount: 2,
    },
  });

  await prisma.normalizedScore.upsert({
    where: { id: "norm_score_s1" },
    update: { normalizedValue: 92.45 },
    create: {
      id: "norm_score_s1",
      normalizationRunId: normRun.id,
      submissionId: submission1.id,
      judgeId: "usr_judge_1",
      rawScore: 8.95,
      normalizedValue: 92.45,
      zScore: 1.84,
      percentile: 96.7,
    },
  });
  console.info("  [SEED] Configured normalization runs.");

  // 13. Results & Result Snapshots
  const snapshot1 = await prisma.resultSnapshot.upsert({
    where: { id: "snap_event1_v1" },
    update: { status: "PUBLISHED" },
    create: {
      id: "snap_event1_v1",
      eventId: event1.id,
      normalizationRunId: normRun.id,
      version: 1,
      status: "PUBLISHED",
      name: "Raptor Hack 2026 Official Final Results",
      notes: "Audited and verified by organizers. Normalized using Z-score engine.",
      createdById: "usr_org_1",
      finalizedAt: new Date("2026-02-21T11:45:00Z"),
      publishedAt: new Date("2026-02-21T12:00:00Z"),
    },
  });

  await prisma.projectResult.upsert({
    where: { snapshotId_submissionId: { snapshotId: snapshot1.id, submissionId: submission1.id } },
    update: { rank: 1 },
    create: {
      id: "pres_mesh_first",
      snapshotId: snapshot1.id,
      submissionId: submission1.id,
      trackId: track1.id,
      prizeId: prize1.id,
      rank: 1,
      trackRank: 1,
      rawAggregateScore: 8.95,
      normalizedScore: 92.45,
      finalScore: 92.45,
      scoreCount: 2,
      metadata: {
        title: "Offline Mesh Network",
        teamName: "Mesh Pacesetters",
        variance: "0.1500",
      },
    },
  });

  await prisma.result.upsert({
    where: { eventId_submissionId: { eventId: event1.id, submissionId: submission1.id } },
    update: { rank: 1, isPublished: true },
    create: {
      id: "res_mesh_first",
      eventId: event1.id,
      submissionId: submission1.id,
      trackId: track1.id,
      prizeId: prize1.id,
      rank: 1,
      rawAggregateScore: 8.95,
      normalizedScore: 92.45,
      finalScore: 92.45,
      isPublished: true,
      publishedAt: new Date("2026-02-21T12:00:00Z"),
    },
  });

  // Global AI Sprint (event2) Official Published Results
  const snapshot2 = await prisma.resultSnapshot.upsert({
    where: { id: "snap_event2_v1" },
    update: { status: "PUBLISHED" },
    create: {
      id: "snap_event2_v1",
      eventId: event2.id,
      version: 1,
      status: "PUBLISHED",
      name: "Global AI Sprint Official Results",
      notes: "Official final standings ratified by organizers.",
      createdById: "usr_org_1",
      finalizedAt: new Date("2026-01-29T12:00:00Z"),
      publishedAt: new Date("2026-01-29T12:00:00Z"),
    },
  });

  await prisma.projectResult.upsert({
    where: { snapshotId_submissionId: { snapshotId: snapshot2.id, submissionId: submissionLocked.id } },
    update: { rank: 1 },
    create: {
      id: "pres_omni_first",
      snapshotId: snapshot2.id,
      submissionId: submissionLocked.id,
      rank: 1,
      trackRank: 1,
      rawAggregateScore: 9.40,
      normalizedScore: 95.80,
      finalScore: 95.80,
      scoreCount: 1,
      metadata: {
        title: "OmniAgent: Self-Directed Orchestration",
        teamName: "OmniAgent Labs",
      },
    },
  });

  await prisma.result.upsert({
    where: { eventId_submissionId: { eventId: event2.id, submissionId: submissionLocked.id } },
    update: { rank: 1, isPublished: true },
    create: {
      id: "res_omni_first",
      eventId: event2.id,
      submissionId: submissionLocked.id,
      rank: 1,
      rawAggregateScore: 9.40,
      normalizedScore: 95.80,
      finalScore: 95.80,
      isPublished: true,
      publishedAt: new Date("2026-01-29T12:00:00Z"),
    },
  });
  console.info("  [SEED] Configured published results and result snapshots.");

  // 14. Phase 8: Community Voting, Comments & Anti-Abuse
  await prisma.votingConfig.upsert({
    where: { eventId: event1.id },
    update: {
      isEnabled: true,
      eligibilityMode: VotingEligibilityMode.EVENT_PARTICIPANTS,
      allowParticipantVotes: true,
      allowJudgeVotes: true,
      allowOrganizerVotes: false,
      allowSelfVoting: false,
      publicVoteCounts: true,
      resultsPublished: false,
      randomizeGalleryOrder: true,
      galleryRandomSeed: 42,
    },
    create: {
      eventId: event1.id,
      isEnabled: true,
      eligibilityMode: VotingEligibilityMode.EVENT_PARTICIPANTS,
      allowParticipantVotes: true,
      allowJudgeVotes: true,
      allowOrganizerVotes: false,
      allowSelfVoting: false,
      publicVoteCounts: true,
      resultsPublished: false,
      randomizeGalleryOrder: true,
      galleryRandomSeed: 42,
    },
  });

  await prisma.votingConfig.upsert({
    where: { eventId: event2.id },
    update: {
      isEnabled: false,
      eligibilityMode: VotingEligibilityMode.ALL_AUTHENTICATED,
      allowParticipantVotes: false,
      allowJudgeVotes: false,
      allowOrganizerVotes: false,
      allowSelfVoting: false,
      publicVoteCounts: false,
      resultsPublished: true,
      resultsPublishedAt: new Date("2026-02-21T12:00:00Z"),
      randomizeGalleryOrder: false,
      galleryRandomSeed: 1337,
    },
    create: {
      eventId: event2.id,
      isEnabled: false,
      eligibilityMode: VotingEligibilityMode.ALL_AUTHENTICATED,
      allowParticipantVotes: false,
      allowJudgeVotes: false,
      allowOrganizerVotes: false,
      allowSelfVoting: false,
      publicVoteCounts: false,
      resultsPublished: true,
      resultsPublishedAt: new Date("2026-02-21T12:00:00Z"),
      randomizeGalleryOrder: false,
      galleryRandomSeed: 1337,
    },
  });

  // Fixture Votes
  await prisma.vote.upsert({
    where: { eventId_voterId_submissionId: { eventId: event1.id, voterId: "usr_part_3", submissionId: submission1.id } },
    update: {},
    create: {
      id: "vote_grace_sub1",
      eventId: event1.id,
      submissionId: submission1.id,
      voterId: "usr_part_3",
    },
  });

  await prisma.vote.upsert({
    where: { eventId_voterId_submissionId: { eventId: event1.id, voterId: "usr_judge_1", submissionId: submission1.id } },
    update: {},
    create: {
      id: "vote_clara_sub1",
      eventId: event1.id,
      submissionId: submission1.id,
      voterId: "usr_judge_1",
    },
  });

  await prisma.vote.upsert({
    where: { eventId_voterId_submissionId: { eventId: event2.id, voterId: "usr_part_3", submissionId: submissionLocked.id } },
    update: {},
    create: {
      id: "vote_grace_sub_locked",
      eventId: event2.id,
      submissionId: submissionLocked.id,
      voterId: "usr_part_3",
    },
  });

  // Moderated Comments
  await prisma.comment.upsert({
    where: { id: "comm_001" },
    update: {
      content: "Great demo during the offline sprint!",
      moderationStatus: CommentModerationStatus.PUBLISHED,
    },
    create: {
      id: "comm_001",
      eventId: event1.id,
      submissionId: submission1.id,
      userId: "usr_part_3",
      content: "Great demo during the offline sprint!",
      moderationStatus: CommentModerationStatus.PUBLISHED,
    },
  });

  await prisma.comment.upsert({
    where: { id: "comm_002" },
    update: {
      content: "This contains spammy or inappropriate links.",
      moderationStatus: CommentModerationStatus.HIDDEN,
      moderatedById: "usr_org_1",
      moderatedAt: new Date("2026-02-16T10:00:00Z"),
    },
    create: {
      id: "comm_002",
      eventId: event1.id,
      submissionId: submission1.id,
      userId: "usr_part_2",
      content: "This contains spammy or inappropriate links.",
      moderationStatus: CommentModerationStatus.HIDDEN,
      moderatedById: "usr_org_1",
      moderatedAt: new Date("2026-02-16T10:00:00Z"),
    },
  });

  await prisma.comment.upsert({
    where: { id: "comm_003" },
    update: {
      content: "Super impressed by the local embeddings and retrieval speed!",
      moderationStatus: CommentModerationStatus.PUBLISHED,
    },
    create: {
      id: "comm_003",
      eventId: event2.id,
      submissionId: submissionLocked.id,
      userId: "usr_part_1",
      content: "Super impressed by the local embeddings and retrieval speed!",
      moderationStatus: CommentModerationStatus.PUBLISHED,
    },
  });

  // Abuse Signal Fixture
  await prisma.abuseSignal.upsert({
    where: { id: "abuse_sig_001" },
    update: {},
    create: {
      id: "abuse_sig_001",
      eventId: event1.id,
      signalType: "HIGH_VELOCITY",
      severity: AbuseSignalSeverity.MEDIUM,
      status: AbuseSignalStatus.OPEN,
      description: "Automated alert: High velocity voting activity detected (12 votes in 30 seconds).",
      metadata: { velocityWindowMs: 30000, voteCount: 12, rateLimitTriggered: true },
      userId: "usr_part_2",
    },
  });
  console.info("  [SEED] Configured Phase 8 voting configs, votes, moderated comments, and abuse signals.");

  // 15. Audit Logs
  await prisma.auditLog.upsert({
    where: { id: "audit_init_001" },
    update: {},
    create: {
      id: "audit_init_001",
      eventId: event1.id,
      actorId: "usr_admin_1",
      action: "EVENT_STATE_CHANGED",
      entityType: "Event",
      entityId: event1.id,
      metadata: { previousState: "REGISTRATION_OPEN", newState: "JUDGING_OPEN" },
      timestamp: new Date("2026-02-15T00:00:00Z"),
    },
  });
  console.info("  [SEED] Configured audit logs.");

  // 16. Verifiable Certificates
  await prisma.certificate.upsert({
    where: { verificationId: "RAPTOR-CERT-2026-WIN-9812A" },
    update: { title: "Raptor Hack 2026 — 1st Place Winner" },
    create: {
      id: "cert_win_001",
      eventId: event1.id,
      recipientId: "usr_part_1",
      type: CertificateType.WINNER,
      title: "Raptor Hack 2026 — 1st Place Winner",
      description: "Awarded for exceptional engineering on RaptorMesh.",
      verificationId: "RAPTOR-CERT-2026-WIN-9812A",
      prizeId: prize1.id,
      isRevoked: false,
      issuedAt: new Date("2026-02-22T00:00:00Z"),
    },
  });
  // Revoked Certificate Fixture for verification tests
  await prisma.certificate.upsert({
    where: { verificationId: "RAPTOR-CERT-2026-PAR-REV9901" },
    update: {},
    create: {
      id: "cert_rev_001",
      eventId: event1.id,
      recipientId: "usr_part_2",
      type: CertificateType.PARTICIPATION,
      title: "Raptor Hack 2026 — Participation Certificate (Revoked)",
      description: "Revoked due to code of conduct infraction.",
      verificationId: "RAPTOR-CERT-2026-PAR-REV9901",
      isRevoked: true,
      revocationReason: "Violation of event code of conduct policy section 4.2.",
      issuedAt: new Date("2026-02-22T00:00:00Z"),
    },
  });
  console.info("  [SEED] Configured verifiable certificates (valid + revoked).");

  // 17. Webhooks & Deliveries (Phase 9)
  const webhook1 = await prisma.webhook.upsert({
    where: { id: "wbhk_fixture_1" },
    update: {},
    create: {
      id: "wbhk_fixture_1",
      eventId: event1.id,
      name: "Local Results & Certs Dispatcher",
      url: "http://127.0.0.1:4000/webhooks/raptoros",
      secret: "whsec_test_secret_fixture_1234567890",
      events: ["results.published", "certificate.issued"],
      isActive: true,
    },
  });

  await prisma.webhookDelivery.upsert({
    where: { deliveryId: "del_fixture_001" },
    update: {},
    create: {
      id: "wbhk_del_001",
      webhookId: webhook1.id,
      eventId: event1.id,
      eventType: "results.published",
      deliveryId: "del_fixture_001",
      payload: {
        id: "del_fixture_001",
        event: "results.published",
        timestamp: new Date().toISOString(),
        data: { eventId: event1.id, status: "PUBLISHED" },
      },
      status: "SUCCESS",
      attemptCount: 1,
      statusCode: 200,
      responseBody: '{"received":true}',
      deliveredAt: new Date(),
    },
  });
  console.info("  [SEED] Configured Phase 9 webhooks and deliveries.");

  // 18. API Keys (Phase 9)
  const FIXTURE_API_KEY = "rap_live_admin_secret_fixture_key_123456789";
  const fixtureKeyHash = crypto.createHash("sha256").update(FIXTURE_API_KEY).digest("hex");

  await prisma.apiKey.upsert({
    where: { keyHash: fixtureKeyHash },
    update: {},
    create: {
      id: "apikey_admin_001",
      userId: "usr_admin_1",
      eventId: event1.id,
      name: "Default Admin Automation Key",
      keyPrefix: "rap_live_admin...",
      keyHash: fixtureKeyHash,
      scopes: ["read", "write", "admin"],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.info("  [SEED] Configured Phase 9 API keys.");

  // 19. Signed Judge Records (Phase 9)
  await prisma.signedJudgeRecord.upsert({
    where: { id: "sjr_fixture_001" },
    update: {},
    create: {
      id: "sjr_fixture_001",
      eventId: event1.id,
      submissionId: submissionLocked.id,
      judgePseudonym: "Judge-E5A1C8",
      canonicalData: {
        version: 1,
        eventId: event1.id,
        submissionId: submissionLocked.id,
        finalScore: "92.5000",
        evaluations: [{ judgePseudonym: "Judge-E5A1C8", rawScore: "92.5" }],
      },
      recordHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "MEUCIQDa1b2c3d4e5f6...sample_signature...",
      algorithm: "Ed25519",
    },
  });
  console.info("  [SEED] Configured Phase 9 signed judge records.");

  // 20. Official DOGFOOD 2026 Fixture Ingestion & Checker Authentication Sessions
  await seedDogfoodFixtures(fixturePasswordHash);

  console.info("Database seed completed successfully with zero duplicates.");
}

interface FixtureTrack {
  id: string;
  name: string;
}

interface FixtureJudge {
  id: string;
  name: string;
  email: string;
  tracks?: string[];
}

interface FixtureTeam {
  id: string;
  name: string;
  members?: string[];
}

interface FixtureProject {
  id: string;
  title: string;
  summary?: string;
  track?: string;
  team: string;
  repo_url?: string;
  submitted_at?: string;
  scores?: Record<string, number>;
}

interface FixtureBatch {
  id?: string;
  judge?: string;
  projects?: string[];
}

interface FixtureScore {
  judge: string;
  project: string;
  criteria?: Record<string, number>;
  comment?: string;
  functionality?: number;
  quality?: number;
  innovation?: number;
  [key: string]: unknown;
}

interface FixtureData {
  event?: {
    id: string;
    name: string;
    submissions_close?: string;
  };
  tracks?: FixtureTrack[];
  judges?: FixtureJudge[];
  teams?: FixtureTeam[];
  projects?: FixtureProject[];
  batches?: FixtureBatch[];
  scores?: FixtureScore[];
}

async function seedDogfoodFixtures(fixturePasswordHash: string): Promise<void> {
  const fixtureCandidates = [
    path.resolve(__dirname, "fixtures.json"),
    path.resolve(__dirname, "../fixtures.json"),
  ];
  let fixtureData: FixtureData | null = null;
  for (const p of fixtureCandidates) {
    if (fs.existsSync(p)) {
      try {
        fixtureData = JSON.parse(fs.readFileSync(p, "utf-8")) as FixtureData;
        console.info(`  [SEED] Found DOGFOOD fixtures at: ${p}`);
        break;
      } catch (err) {
        console.warn(`  [SEED] Failed to parse ${p}:`, err);
      }
    }
  }

  if (!fixtureData || !fixtureData.event) {
    console.warn("  [SEED] No fixtures.json found. Skipping fixture ingestion.");
    return;
  }

  const evt = fixtureData.event;
  const submissionsClose = new Date(evt.submissions_close || "2026-03-01T18:00:00Z");

  const event01 = await prisma.event.upsert({
    where: { id: evt.id },
    update: {
      name: evt.name,
      slug: "sample-hack-2026",
      state: EventState.JUDGING_OPEN,
      submissionsStart: new Date("2026-02-01T00:00:00Z"),
      submissionsEnd: submissionsClose,
      judgingStart: submissionsClose,
      judgingEnd: new Date("2026-03-15T18:00:00Z"),
      registrationStart: new Date("2026-01-01T00:00:00Z"),
      registrationEnd: submissionsClose,
      startsAt: new Date("2026-02-01T00:00:00Z"),
      endsAt: new Date("2026-03-20T00:00:00Z"),
    },
    create: {
      id: evt.id,
      name: evt.name,
      slug: "sample-hack-2026",
      state: EventState.JUDGING_OPEN,
      description: "DOGFOOD 2026 official fixture event.",
      timezone: "UTC",
      submissionsStart: new Date("2026-02-01T00:00:00Z"),
      submissionsEnd: submissionsClose,
      judgingStart: submissionsClose,
      judgingEnd: new Date("2026-03-15T18:00:00Z"),
      registrationStart: new Date("2026-01-01T00:00:00Z"),
      registrationEnd: submissionsClose,
      startsAt: new Date("2026-02-01T00:00:00Z"),
      endsAt: new Date("2026-03-20T00:00:00Z"),
    },
  });

  // Assign organizer membership in evt_01 to usr_org_1
  await prisma.eventMembership.upsert({
    where: {
      userId_eventId_role: {
        userId: "usr_org_1",
        eventId: event01.id,
        role: EventRole.ORGANIZER,
      },
    },
    update: { status: MembershipStatus.ACTIVE },
    create: {
      userId: "usr_org_1",
      eventId: event01.id,
      role: EventRole.ORGANIZER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Tracks
  const tracksList = fixtureData.tracks || [];
  for (let i = 0; i < tracksList.length; i++) {
    const trk = tracksList[i];
    if (!trk) continue;
    await prisma.track.upsert({
      where: { eventId_slug: { eventId: event01.id, slug: trk.id } },
      update: { name: trk.name, order: i + 1 },
      create: {
        id: trk.id,
        eventId: event01.id,
        name: trk.name,
        slug: trk.id,
        description: `Track: ${trk.name}`,
        order: i + 1,
      },
    });
  }

  // Judges
  for (const j of fixtureData.judges || []) {
    await prisma.user.upsert({
      where: { id: j.id },
      update: { email: j.email, name: j.name, passwordHash: fixturePasswordHash },
      create: {
        id: j.id,
        email: j.email,
        name: j.name,
        passwordHash: fixturePasswordHash,
        bio: `Fixture Judge ${j.name}`,
      },
    });

    await prisma.eventMembership.upsert({
      where: {
        userId_eventId_role: {
          userId: j.id,
          eventId: event01.id,
          role: EventRole.JUDGE,
        },
      },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        userId: j.id,
        eventId: event01.id,
        role: EventRole.JUDGE,
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  // Teams & Participants
  for (const tm of fixtureData.teams || []) {
    const memberEmails: string[] = tm.members || [];
    const memberUserIds: string[] = [];

    for (let idx = 0; idx < memberEmails.length; idx++) {
      const email = memberEmails[idx];
      if (!email) continue;
      const userId = `usr_${tm.id}_${idx + 1}`;
      const name = email.split("@")[0] || "member";

      const u = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: {
          id: userId,
          email,
          name,
          passwordHash: fixturePasswordHash,
          bio: `Team member of ${tm.name}`,
        },
      });

      memberUserIds.push(u.id);

      await prisma.eventMembership.upsert({
        where: {
          userId_eventId_role: {
            userId: u.id,
            eventId: event01.id,
            role: EventRole.PARTICIPANT,
          },
        },
        update: { status: MembershipStatus.ACTIVE },
        create: {
          userId: u.id,
          eventId: event01.id,
          role: EventRole.PARTICIPANT,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    const creatorId = memberUserIds[0] || "usr_part_1";

    const team = await prisma.team.upsert({
      where: { id: tm.id },
      update: { name: tm.name },
      create: {
        id: tm.id,
        eventId: event01.id,
        name: tm.name,
        slug: tm.id,
        creatorId,
        description: `Team ${tm.name}`,
      },
    });

    for (let idx = 0; idx < memberUserIds.length; idx++) {
      const uid = memberUserIds[idx];
      if (!uid) continue;
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: uid } },
        update: { role: idx === 0 ? TeamMemberRole.LEADER : TeamMemberRole.MEMBER },
        create: {
          teamId: team.id,
          userId: uid,
          role: idx === 0 ? TeamMemberRole.LEADER : TeamMemberRole.MEMBER,
        },
      });
    }
  }

  // Ensure default participant usr_part_1 has PARTICIPANT membership in evt_01
  await prisma.eventMembership.upsert({
    where: {
      userId_eventId_role: {
        userId: "usr_part_1",
        eventId: event01.id,
        role: EventRole.PARTICIPANT,
      },
    },
    update: { status: MembershipStatus.ACTIVE },
    create: {
      userId: "usr_part_1",
      eventId: event01.id,
      role: EventRole.PARTICIPANT,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Projects / Submissions
  for (const p of fixtureData.projects || []) {
    const submittedAt = new Date(p.submitted_at || "2026-02-27T00:00:00Z");
    const desc = p.summary && p.summary.length >= 10 ? p.summary : `${p.summary} - Detailed overview for ${p.title}.`;

    let assignedTeamId = p.team;
    const existingSubmissionForTeam = await prisma.submission.findUnique({
      where: { teamId: p.team },
    });

    if (existingSubmissionForTeam && existingSubmissionForTeam.id !== p.id) {
      assignedTeamId = `${p.team}_${p.id}`;
      await prisma.team.upsert({
        where: { id: assignedTeamId },
        update: {},
        create: {
          id: assignedTeamId,
          eventId: event01.id,
          name: `${p.team} (Duplicate Submission)`,
          slug: assignedTeamId,
          creatorId: "usr_part_1",
          description: `Duplicate submission team alias for ${p.id}`,
        },
      });
    }

    await prisma.submission.upsert({
      where: { id: p.id },
      update: {
        title: p.title,
        description: desc,
        repositoryUrl: p.repo_url || null,
        state: SubmissionState.SUBMITTED,
        submittedAt,
        teamId: assignedTeamId,
      },
      create: {
        id: p.id,
        eventId: event01.id,
        teamId: assignedTeamId,
        trackId: p.track,
        title: p.title,
        description: desc,
        repositoryUrl: p.repo_url || null,
        state: SubmissionState.SUBMITTED,
        submittedAt,
        createdAt: submittedAt,
      },
    });
  }

  // Rubric & Criteria
  const rubric = await prisma.rubric.upsert({
    where: { id: "rubric_fixture_01" },
    update: {},
    create: {
      id: "rubric_fixture_01",
      eventId: event01.id,
      name: "Dogfood 2026 Official Rubric",
      description: "Standard 3-criteria evaluation rubric.",
    },
  });

  const rubricVersion = await prisma.rubricVersion.upsert({
    where: { rubricId_versionNumber: { rubricId: rubric.id, versionNumber: 1 } },
    update: {},
    create: {
      id: "rubver_fixture_01",
      rubricId: rubric.id,
      versionNumber: 1,
      isActive: true,
    },
  });

  const critFunc = await prisma.rubricCriterion.upsert({
    where: { rubricVersionId_name: { rubricVersionId: rubricVersion.id, name: "functionality" } },
    update: {},
    create: {
      id: "crit_func_01",
      rubricVersionId: rubricVersion.id,
      name: "functionality",
      description: "Functional correctness and stability",
      weight: 0.34,
      maxScore: 5.0,
      order: 1,
    },
  });

  const critQual = await prisma.rubricCriterion.upsert({
    where: { rubricVersionId_name: { rubricVersionId: rubricVersion.id, name: "quality" } },
    update: {},
    create: {
      id: "crit_qual_01",
      rubricVersionId: rubricVersion.id,
      name: "quality",
      description: "Code architecture and design quality",
      weight: 0.33,
      maxScore: 5.0,
      order: 2,
    },
  });

  const critInno = await prisma.rubricCriterion.upsert({
    where: { rubricVersionId_name: { rubricVersionId: rubricVersion.id, name: "innovation" } },
    update: {},
    create: {
      id: "crit_inno_01",
      rubricVersionId: rubricVersion.id,
      name: "innovation",
      description: "Creativity and unique perspective",
      weight: 0.33,
      maxScore: 5.0,
      order: 3,
    },
  });

  const critMap: Record<string, string> = {
    functionality: critFunc.id,
    quality: critQual.id,
    innovation: critInno.id,
  };

  // Scores
  const scoresList = fixtureData.scores || [];
  for (let sIdx = 0; sIdx < scoresList.length; sIdx++) {
    const s = scoresList[sIdx];
    if (!s) continue;
    const commentStr = typeof s.comment === "string" ? s.comment : null;

    await prisma.judgeAssignment.upsert({
      where: {
        eventId_judgeId_submissionId: {
          eventId: event01.id,
          judgeId: s.judge,
          submissionId: s.project,
        },
      },
      update: { status: AssignmentStatus.COMPLETED },
      create: {
        eventId: event01.id,
        judgeId: s.judge,
        submissionId: s.project,
        status: AssignmentStatus.COMPLETED,
      },
    });

    const scoreRec = await prisma.score.upsert({
      where: {
        judgeId_submissionId_rubricVersionId: {
          judgeId: s.judge,
          submissionId: s.project,
          rubricVersionId: rubricVersion.id,
        },
      },
      update: {
        feedback: commentStr,
        isFinal: true,
      },
      create: {
        id: `sc_fix_${sIdx + 1}`,
        eventId: event01.id,
        judgeId: s.judge,
        submissionId: s.project,
        rubricVersionId: rubricVersion.id,
        feedback: commentStr,
        isFinal: true,
      },
    });

    if (s.criteria) {
      for (const [cName, val] of Object.entries(s.criteria)) {
        const critId = critMap[cName];
        if (critId) {
          await prisma.scoreItem.upsert({
            where: {
              scoreId_criterionId: {
                scoreId: scoreRec.id,
                criterionId: critId,
              },
            },
            update: { rawScore: Number(val) },
            create: {
              scoreId: scoreRec.id,
              criterionId: critId,
              rawScore: Number(val),
            },
          });
        }
      }
    }
  }

  // Deterministic Dogfood Acceptance Sessions
  const DOGFOOD_SESSIONS = [
    { id: "sess_df_org", userId: "usr_org_1", token: "org_7f2a", role: "organizer" },
    { id: "sess_df_jdg_a", userId: "jdg_01", token: "jdg_a_91bc", role: "judge_a" },
    { id: "sess_df_jdg_b", userId: "jdg_02", token: "jdg_b_44de", role: "judge_b" },
    { id: "sess_df_prt", userId: "usr_part_1", token: "prt_2e88", role: "participant" },
  ];

  for (const s of DOGFOOD_SESSIONS) {
    const tokenHash = crypto.createHash("sha256").update(s.token).digest("hex");
    await prisma.session.upsert({
      where: { id: s.id },
      update: {
        tokenHash,
        expiresAt: new Date(Date.now() + 365 * 86400000),
        isRevoked: false,
      },
      create: {
        id: s.id,
        userId: s.userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 365 * 86400000),
        userAgent: `DOGFOOD 2026 Acceptance Persona (${s.role})`,
        isRevoked: false,
      },
    });
  }

  // Configure community voting for DOGFOOD event
  await prisma.votingConfig.upsert({
    where: { eventId: event01.id },
    update: {
      isEnabled: true,
      eligibilityMode: VotingEligibilityMode.ALL_AUTHENTICATED,
      allowParticipantVotes: true,
      allowJudgeVotes: true,
      allowOrganizerVotes: true,
      allowSelfVoting: false,
      publicVoteCounts: true,
      resultsPublished: false,
      randomizeGalleryOrder: true,
      galleryRandomSeed: 42,
    },
    create: {
      id: "vc_evt_01",
      eventId: event01.id,
      isEnabled: true,
      eligibilityMode: VotingEligibilityMode.ALL_AUTHENTICATED,
      allowParticipantVotes: true,
      allowJudgeVotes: true,
      allowOrganizerVotes: true,
      allowSelfVoting: false,
      publicVoteCounts: true,
      resultsPublished: false,
      randomizeGalleryOrder: true,
      galleryRandomSeed: 42,
    },
  });

  console.info("  [SEED] Configured DOGFOOD 2026 fixtures (event, tracks, judges, teams, projects, scores, sessions).");
  console.info("================================================================");
  console.info("  DOGFOOD 2026 ACCEPTANCE CHECKER AUTH READY:");
  console.info('  organizer   = "Cookie: session=org_7f2a"');
  console.info('  judge_a     = "Cookie: session=jdg_a_91bc"');
  console.info('  judge_b     = "Cookie: session=jdg_b_44de"');
  console.info('  participant = "Cookie: session=prt_2e88"');
  console.info("================================================================");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
