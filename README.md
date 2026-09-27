# RaptorOS — Hackathon Operating System

> **Run your hackathon from registration to results.**  
> An offline-first, self-hostable hackathon management and judging platform engineered for extreme reliability in competition environments.

---

## 1. What RaptorOS Is

RaptorOS is an open-source, production-grade platform designed to manage and judge hackathons. Unlike existing SaaS tools that depend heavily on cloud APIs, third-party authentication services, or unstable internet connections in crowded venue halls, RaptorOS is engineered from day one to be:

- **Offline-First & Self-Hostable**: Capable of booting and executing all mission-critical hackathon workflows locally inside an isolated local network (LAN) without internet access.
- **Resilient & Deterministic**: Zero unverified external dependencies, local assets, deterministic database migrations, and clean container orchestration.
- **Architecturally Extensible**: Built as a clean modular monolith that allows future business capabilities to be added without structural rewrites.
- **Secure & Event-Scoped**: Zero third-party auth vendors (no Clerk, Supabase Auth, Firebase, or Auth0). Passwords hashed using memory-hard scrypt, server-side sessions hashed with SHA-256 in PostgreSQL, and permissions strictly partitioned per hackathon event via `EventMembership`.

---

## 2. Platform Status & Phases

- **Phase 1 (Completed & Audited)**: Production foundation, Dockerized Next.js 15 & PostgreSQL 16, health check API, structured error/logger, responsive dark application shell.
- **Phase 2 (Completed & Audited)**: Domain & database architecture with 16 core Prisma models covering the full hackathon lifecycle (Users, Events, Memberships, Teams, Submissions, Rubrics, Judge Assignments, Scores, Normalization, Votes, Audit Logs, Certificates).
- **Phase 3 (Completed & Audited)**: Secure, self-contained authentication, sessions, and event-scoped role-based access control (RBAC).
- **Phase 4 (Completed & Audited)**: Event management, lifecycle transitions (`DRAFT` -> `PUBLISHED` -> `REGISTRATION_OPEN` -> `SUBMISSIONS_OPEN` -> `JUDGING` -> `RESULTS_PUBLISHED`), participant registration, team formation, invitations, and roster management.
- **Phase 5 (Completed & Verified)**: Complete project submission lifecycle & public gallery:
  - Draft creation, iterative editing, URL scheme allowlist (`http:`, `https:`), and XSS input sanitization.
  - Team captain authority (`LEADER`), event submission window enforcement, and minimum team size verification.
  - Versioned immutable snapshots (`SubmissionVersion`) preserving submission audit history.
  - Organizer submission locking, disqualification, and restoration controls.
  - Public Project Showcase & Gallery (`/gallery`, `/gallery/[submissionId]`) with search, event/track filtering, and privacy protection.
  - Participant Submissions Dashboard (`/dashboard/submissions`) with active event switcher and status badges.
- **Phase 6 (Completed & Verified)**: Judging Configuration, Judge Assignment & Scoring:
  - Multi-criteria rubric management with strict weight validation (`validateCriteriaWeights`, summing to 100% or 1.00) and atomic version publishing.
  - Deterministic balanced judge assignment engine with pre-computed conflict detection (prevents judges from evaluating their own team's submissions), capacity balancing, and `AssignmentBatch` history.
  - High-precision Decimal scoring calculations (`decimal.js`), draft mode saving vs. atomic score finalization.
  - Score immutability (`isFinal: true` locks scores as permanent historical evidence).
  - Strict lifecycle guarding: evaluations permitted only in `EventState.JUDGING_OPEN`.
  - Comprehensive Judge Portal (`/judge`, `/judge/[assignmentId]`) and Organizer Judging Console with real-time coverage and workload metrics.
- **Phase 7 (Completed & Verified)**: Score Normalization, Fairness Analytics, Rankings & Results Integrity:
  - High-precision statistical normalization engine (`Z_SCORE` with scaled T-scores $50 + 15z$, clamped $[0, 100]$, and `MIN_MAX`).
  - Zero-variance protection: single evaluation or uniform scoring safely resolves to neutral 50.00 without NaN/Infinity runtime crashes.
  - Judge calibration analytics: judge mean, median, standard deviation ($\sigma$), scoring range, severity index, and statistical outlier detection ($|z| \ge 2.0$).
  - Fully deterministic 4-tier ranking & tie-break resolution: (1) `finalScore` DESC $\rightarrow$ (2) `rawAggregateScore` DESC $\rightarrow$ (3) `variance` ASC $\rightarrow$ (4) `submissionId` ASC.
  - Complete snapshot governance lifecycle (`DRAFT` $\rightarrow$ `FINALIZED` $\rightarrow$ `PUBLISHED`) with permanent immutability once published.
  - Comprehensive Organizer Results & Fairness Console (`components/results/organizer-results-dashboard.tsx`) with 4 dedicated management tabs.
  - Public Results Showcase (`/events/[eventId]/results`) exposing only sanitized placements (podium top 3 cards + placement table) with zero leakage of judge identities, raw scores, or internal calibration data.
- **Phase 8 (Completed & Verified)**: Community Voting, Comments & Anti-Abuse:
  - Per-event community voting configuration with date windows, eligibility tiers (`PUBLIC`, `REGISTERED_PARTICIPANTS`, `SUBMITTING_TEAMS_ONLY`), and vote retraction.
  - Strict database-enforced one-person/one-vote guarantees with 409 Conflict handling on concurrency.
  - Complete scoring separation: community votes never mutate or touch official Phase 7 judge scores, normalization, or awards.
  - Server-side team membership validation preventing self-voting.
  - Public visibility controls: live vote counts concealed from participants and gallery until organizer explicitly publishes community results.
  - Plain-text comment discussion feed with tag stripping, line-ending normalization, length enforcement (2–1000 chars), and author deletion.
  - Organizer comment moderation queue (`PUBLISHED`, `HIDDEN`, `REMOVED`) with audit reasons.
  - In-memory sliding-window rate limiters (votes and comments) and automated velocity anomaly detection.
  - Non-destructive `AbuseSignal` review queue: heuristics never silently delete valid votes.
  - Deterministic seeded pseudo-random gallery ordering mitigating top-row exposure bias without breaking pagination.
- **Phase 9 (Completed & Verified)**: T4 Stretch: REST API, Webhooks, Certificates, Verification & Export:
  - Complete, versioned REST API (`/api/v1`) exposing identical domain service layer as web UI with standardized `{ "data": ... }` response envelopes.
  - Dual authentication: Browser HttpOnly session cookies + Bearer API keys (`rap_live_<24-hex-bytes>`) hashed with SHA-256 in PostgreSQL.
  - Webhooks subsystem with HMAC-SHA256 signatures (`X-RaptorOS-Signature: sha256=<hex>`), replay protection (`X-RaptorOS-Delivery`), and resilient offline failure handling.
  - Verifiable participant records and certificates with server-side eligibility checks (`PARTICIPATION`, `WINNER`, `JUDGE`, `ORGANIZER`), cryptographically unguessable verification IDs (`RAPTOR-CERT-YYYY-<TYPE>-<RANDOM12HEX>`), and public verification at `/verify/certificate/:verificationCode`.
  - Cryptographically signed judge evaluation records with Ed25519 digital signatures, canonical JSON alphabetization, and public key verification endpoint (`/api/v1/public-key`).
  - High-performance RFC-4180 CSV import & export engine for participants, teams, and submissions with row-level validation.
  - Embeddable public gallery (`/embed/events/:eventId/gallery`) designed for seamless embedding in external event websites and displays via iframe.
  - Comprehensive documentation (`docs/API.md`, `docs/WEBHOOKS.md`, `docs/CERTIFICATES.md`, `/api/v1/openapi.json`).
- **Phase 10 (Completed & Audited)**: Final Hardening & Submission Readiness:
  - Complete security audit and remediation of Webhook SSRF vulnerability (`lib/security/ssrf.ts`).
  - Comprehensive Dogfood 2026 Acceptance Report (`docs/ACCEPTANCE-REPORT.md`) with official Tier matrices.
  - Rigorous Threat Model & Security Audit reports (`docs/THREAT-MODEL.md`, `docs/SECURITY-AUDIT.md`).
  - Formal OSI-approved Apache-2.0 open-source licensing (`LICENSE`).
  - 100% offline-first certification with zero external cloud dependencies.
  - Verification of clean Docker installation, migrations, and deterministic seed.

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server-side rendering, React Server Components, Route Handlers |
| **Language** | TypeScript (Strict Mode) | Zero `any`, strict null checks, type safety across boundaries |
| **UI & Styling** | React 19, Tailwind CSS | High performance, accessible component styling, system font stack |
| **Icons** | Lucide React | Clean, scalable SVG icons bundled locally |
| **Database** | PostgreSQL 16 Alpine | Robust relational persistence, JSON support, transaction safety |
| **ORM** | Prisma ORM | Type-safe queries, reproducible migrations, connection pooling |
| **Authentication** | Node.js `crypto.scrypt` | Memory-hard, offline password hashing with constant-time verification |
| **Sessions** | Cryptographic SHA-256 Tokens | Stored as SHA-256 hashes in DB, delivered in HttpOnly secure cookies |
| **Validation** | Zod | Runtime schema validation for environment variables and API inputs |
| **Unit Testing** | Vitest | Extremely fast, ESM-native unit and integration test runner |
| **E2E Testing** | Playwright | Reliable cross-browser end-to-end automation |
| **Containers** | Docker & Docker Compose | Multi-stage image build, service health checks, isolated bridge network |

---

## 4. Development Accounts & Fixture Credentials

During deterministic seeding (`prisma/seed.ts`), the platform creates 7 standard test personas with secure fixture passwords. All seeded accounts share the password:

```
TestPassword123!
```

| Persona | Email | Primary Event Role | Description |
|---|---|---|---|
| **Alice Admin** | `admin@raptoros.internal` | `ADMIN` (Event 2), `ORGANIZER` (Event 1) | Platform and event administrator |
| **Oliver Organizer** | `organizer@raptoros.internal` | `ORGANIZER` (Event 1) | Event organizer managing logistics & tracks |
| **Judge Judy** | `judge.judy@raptoros.internal` | `JUDGE` (Event 1 & 2) | Assigned evaluation judge |
| **Judge Marcus** | `judge.marcus@raptoros.internal` | `JUDGE` (Event 1) | Assigned evaluation judge |
| **Peter Participant** | `peter@raptoros.internal` | `PARTICIPANT` (Event 1) | Team Captain on "Team Neural Raptors" |
| **Penny Participant** | `penny@raptoros.internal` | `PARTICIPANT` (Event 1) | Team Member on "Team Neural Raptors" |
| **Paul Participant** | `paul@raptoros.internal` | `PARTICIPANT` (Event 1) | Team Member on "Team Quantum Byte" |

---

## 5. Quick Start (Single Command)

To boot the complete RaptorOS environment with PostgreSQL, automated migrations, deterministic seeding, and the web application:

```bash
docker compose up -d --build
```

Once running:
- Open your browser to: **`http://localhost:3000`**
- Log in with: **`admin@raptoros.internal`** / **`TestPassword123!`**
- Check system health: **`http://localhost:3000/api/health`**
- Inspect account & active sessions: **`http://localhost:3000/account`**

To shut down the platform:
```bash
docker compose down
```

To shut down and wipe the database volume for a clean scratch test:
```bash
docker compose down -v
```

---

## 6. Authentication & RBAC Architecture

### 1. Zero Cloud Dependency
RaptorOS operates 100% offline. There are zero external API calls or third-party identity providers.

### 2. Password Security
- Passwords are encrypted with Node.js native `crypto.scrypt`.
- Memory-hard parameters: $N=16384, r=8, p=1$.
- 16-byte cryptographically secure random salt per user.
- Hash format: `$scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>`.
- Verification uses `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

### 3. Session Security
- Raw session tokens are 32 random bytes (64 hex characters) generated via `crypto.randomBytes(32)`.
- The database stores **only the SHA-256 hash** of the session token (`tokenHash`). Even in the event of a database compromise, raw session tokens cannot be retrieved.
- Session tokens are transmitted exclusively in `HttpOnly`, `SameSite=Lax`, `Path=/` cookies.

### 4. Event-Scoped RBAC
There is **no global `User.role`** column. Authorization is strictly partitioned per hackathon:
- A user may be an `ORGANIZER` in Event A, a `JUDGE` in Event B, and a `PARTICIPANT` in Event C.
- Authorization checks are performed with `requireEventRole(eventId, [EventRole.ORGANIZER, EventRole.ADMIN])`.

---

## 7. Environment Variables

All variables are validated at application boot via Zod schema (`lib/env/env.ts`). See `.env.example`.

| Variable | Scope | Required | Description | Example |
|---|---|---|---|---|
| `NODE_ENV` | Server | No | Environment mode (`development`, `production`, `test`) | `production` |
| `PORT` | Server | No | Port on which HTTP server listens (default: 3000) | `3000` |
| `DATABASE_URL` | Server | **Yes** | PostgreSQL connection URI | `postgresql://user:pass@host:5432/raptoros` |
| `SESSION_SECRET` | Server | No | Cryptographic secret for session signing (min 32 chars) | (offline default provided) |
| `AUTH_COOKIE_NAME` | Server | No | Session cookie identifier | `raptoros_session` |
| `NEXT_PUBLIC_APP_NAME` | Client/Server | No | Platform branding name | `RaptorOS` |
| `NEXT_PUBLIC_APP_VERSION` | Client/Server | No | Current platform release version | `0.3.0-phase3` |

---

## 8. Verification & Quality Commands

```bash
# 1. Code quality & linting (ESLint 9) - 0 errors
npm run lint

# 2. TypeScript strict typechecking (tsc --noEmit) - 0 errors
npm run typecheck

# 3. Unit & integration test suite (183 tests across 35 test files) - 100% passing
npm run test

# 4. Production standalone build compilation
npm run build

# 5. Playwright End-to-End test suite (18 tests across 6 test files) - 100% passing
npx playwright test
```

---

## 9. API Endpoints

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Health diagnostics and DB connectivity | Public |
| `POST` | `/api/auth/register` | Register a new local user account | Public |
| `POST` | `/api/auth/login` | Authenticate with email & password | Public |
| `POST` | `/api/auth/logout` | Revoke current session & clear cookie | Authenticated |
| `GET` | `/api/auth/me` | Fetch authenticated user profile & event memberships | Authenticated |
| `GET` | `/api/gallery` | Public project showcase gallery | Public |
| `GET` | `/api/gallery/[submissionId]` | Public project snapshot details | Public |
| `POST` | `/api/events/[eventId]/submissions` | Create draft project submission | Participant |
| `POST` | `/api/submissions/[submissionId]/submit` | Finalize & submit entry (Captain only) | Team Captain |
| `POST` | `/api/submissions/[submissionId]/lock` | Administratively freeze project submission | Organizer/Admin |
| `GET` | `/api/events/[eventId]/rubrics` | List evaluation rubrics & criteria | Event Member |
| `POST` | `/api/events/[eventId]/rubrics` | Create multi-criteria evaluation rubric | Organizer/Admin |
| `POST` | `/api/events/[eventId]/rubrics/[rubricId]/versions` | Create new versioned criteria snapshot | Organizer/Admin |
| `POST` | `/api/events/[eventId]/rubrics/[rubricId]/publish` | Publish & activate rubric version | Organizer/Admin |
| `POST` | `/api/events/[eventId]/judging/assignments/generate` | Run deterministic balanced assignment engine | Organizer/Admin |
| `GET` | `/api/events/[eventId]/judging/assignments` | List judge assignments & coverage | Organizer/Admin |
| `DELETE` | `/api/events/[eventId]/judging/assignments` | Revoke judge assignment (marks EXCUSED) | Organizer/Admin |
| `GET` | `/api/events/[eventId]/judging/batches` | View assignment generation batch history | Organizer/Admin |
| `GET` | `/api/events/[eventId]/judging/progress` | Event evaluation progress & workload metrics | Organizer/Admin |
| `GET` | `/api/judge/assignments` | Judge portal active assignments & workload | Assigned Judge |
| `GET` | `/api/judge/assignments/[assignmentId]` | Evaluation workspace for assigned project | Assigned Judge |
| `POST` | `/api/judge/assignments/[assignmentId]/score` | Save draft evaluation scores | Assigned Judge |
| `POST` | `/api/judge/assignments/[assignmentId]/score/finalize` | Finalize immutable evaluation score | Assigned Judge |
| `GET` | `/api/events/[eventId]/normalization/runs` | List normalization runs for event | Organizer/Admin |
| `POST` | `/api/events/[eventId]/normalization/runs` | Execute Z-Score or Min-Max normalization run | Organizer/Admin |
| `GET` | `/api/events/[eventId]/normalization/runs/[runId]` | Inspect run statistics, judge stats & scores | Organizer/Admin |
| `GET` | `/api/events/[eventId]/normalization/calibration` | Judge calibration analytics & outlier metrics | Organizer/Admin |
| `GET` | `/api/events/[eventId]/results/rankings` | Compute on-demand rankings preview with ties | Organizer/Admin |
| `GET` | `/api/events/[eventId]/results/snapshots` | List versioned result snapshots | Organizer/Admin |
| `POST` | `/api/events/[eventId]/results/snapshots` | Create immutable result snapshot (`DRAFT`) | Organizer/Admin |
| `GET` | `/api/events/[eventId]/results/snapshots/[snapshotId]` | View snapshot ranking details | Organizer/Admin |
| `POST` | `/api/events/[eventId]/results/snapshots/[snapshotId]/finalize` | Transition snapshot from `DRAFT` to `FINALIZED` | Organizer/Admin |
| `POST` | `/api/events/[eventId]/results/snapshots/[snapshotId]/publish` | Publish snapshot & expose public leaderboard | Organizer/Admin |
| `GET` | `/api/events/[eventId]/results/public` | Sanitized public leaderboard (top 3 + rankings) | Public |

---

## 10. Project Directory Structure

```
raptoros/
├── app/
│   ├── (auth)/                    # Sign in & register interfaces
│   ├── (platform)/
│   │   ├── account/page.tsx       # Account profile, event roles & sessions
│   │   ├── dashboard/             # Participant dashboard & submissions tracker
│   │   ├── events/
│   │   │   ├── [eventId]/manage   # Organizer management console (Events, Submissions, Judging, Results)
│   │   │   ├── [eventId]/results  # Sanitized public leaderboard & placement showcase
│   │   │   └── page.tsx           # Event discovery & details
│   │   ├── gallery/               # Public project gallery & detail views
│   │   ├── judge/                 # Judge portal dashboard & assignment evaluation
│   │   ├── layout.tsx             # Platform shell with sidebar & header
│   │   └── page.tsx               # Foundation dashboard & system diagnostics
│   ├── api/
│   │   ├── auth/                  # login, logout, me, register
│   │   ├── events/                # events CRUD, transition, tracks, prizes, teams, rubrics, judging, normalization, results
│   │   ├── gallery/               # public showcase endpoints
│   │   ├── health/                # GET /api/health
│   │   ├── invitations/           # accept, reject
│   │   ├── judge/                 # judge portal assignments & scoring endpoints
│   │   ├── submissions/           # draft, finalize, lock, disqualify, restore
│   │   └── teams/                 # invitations, leave, member removal
├── components/
│   ├── auth/                      # UserNav, LogoutButton
│   ├── events/                    # CreateEventForm, OrganizerDashboard
│   ├── judging/                   # RubricManager, AssignmentGenerator, JudgingProgressCard, JudgeScoringForm
│   ├── results/                   # OrganizerResultsDashboard (Normalization, Calibration, Rankings, Snapshots)
│   ├── submissions/               # SubmissionForm, SubmissionActions
│   ├── teams/                     # CreateTeamForm, TeamRosterTable
│   ├── layout/                    # Header, PlatformSidebar
│   └── ui/                        # Accessible Button, Badge, Card, Table, Input, Textarea
├── docs/
│   ├── ARCHITECTURE.md            # Modular architecture & RBAC model
│   ├── DATA-MODEL.md              # Domain architecture specification
│   ├── EVENT-LIFECYCLE.md         # State machine & team workflow specification
│   ├── JUDGING.md                 # Rubrics, balanced assignments, normalization, calibration & results integrity
│   ├── SECURITY.md                # Cryptography & offline security specifications
│   └── SUBMISSIONS.md             # Submission lifecycle & public showcase specification
├── e2e/
│   ├── auth.spec.ts               # E2E authentication & RBAC tests
│   ├── event-lifecycle.spec.ts    # E2E event creation, registration, team workflows
│   ├── home.spec.ts               # E2E application shell & health diagnostics
│   ├── judging-workflow.spec.ts   # E2E judge portal, scoring drafts & organizer judging tab
│   ├── results-workflow.spec.ts   # E2E normalization, calibration, snapshots, public results
│   └── submission-workflow.spec.ts# E2E project submissions & gallery showcase
├── prisma/
│   ├── migrations/                # Version-controlled SQL migrations (16 core + normalization & snapshots)
│   ├── schema.prisma              # Domain models + NormalizationRun + ResultSnapshot + ProjectResult
│   └── seed.ts                    # Idempotent deterministic seed (v0.7.0-phase7)
├── server/
│   ├── auth/                      # Password hashing, sessions, rate limiter, RBAC
│   ├── repositories/              # Event, Registration, Team, Rubric, Judging, Submission, Normalization, Results, User
│   └── services/                  # Event, Registration, Team, Rubric, Assignment, Scoring, Judging, Normalization, Results, Audit
└── tests/
    ├── integration/               # Normalization pipeline, results access control, judging, submissions, teams, auth, webhooks, SSRF
    └── unit/                      # Normalization formulas, calibration analytics, 4-tier ranking, SSRF validator, Decimal calculations
```

---

## 11. Deterministic 5-Minute Demo Flow

RaptorOS includes a pre-seeded, deterministic demo dataset ready immediately upon `docker compose up` or `npm run prisma:seed`. No waiting for real-world countdown timers.

> [!NOTE]
> **Development Fixture Credentials** (Development/Demo use only):
> - Password for all seeded accounts: `TestPassword123!`
> - **Lead Organizer**: `organizer.bob@raptoros.internal`
> - **AI / Systems Judge**: `judge.clara@raptoros.internal`
> - **Participant**: `hacker.elena@raptoros.internal`
> - **Administrator**: `admin@raptoros.internal`

### Demo Timeline:
- **00:00 — Login**: Navigate to `http://localhost:3000/login` and log in as `organizer.bob@raptoros.internal`.
- **00:30 — Event, Teams & Submissions**: Open `/events/raptor-hack-2026/manage`. View active registered teams, track distributions, and finalized project submissions.
- **01:15 — Public Gallery**: Open `/gallery` to inspect submitted projects with search, track filters, and randomized ordering.
- **01:45 — Judge Portal**: Log out and log in as `judge.clara@raptoros.internal`. Visit `/judge` to view assigned projects with conflict-of-interest prevention.
- **02:15 — Scoring Workspace**: Click an assignment at `/judge/[assignmentId]`. View multi-criteria rubric sliders with real-time weighted scoring and submit evaluation.
- **02:45 — Normalization & Fairness**: Switch to Organizer. Open `/events/raptor-hack-2026/manage` -> **Results** tab. Execute a Z-Score Normalization Run ($50 + 15z$), inspect judge calibration severity (Lenient/Strict), and detect statistical outliers.
- **03:15 — Results Publication**: Generate a 4-tier deterministic ranking snapshot, review the podium leaderboard, and click **Publish Results**. View the sanitized public leaderboard at `/events/raptor-hack-2026/results`.
- **03:45 — Community Voting & Discussion**: Cast a community vote on a project and post a project discussion comment with real-time XSS sanitization.
- **04:10 — Certificate Public Verification**: Open `/verify/certificate/RAPTOR-CERT-2026-WINNER-A1B2C3D4E5F6` to inspect tamper-proof cryptographic award verification.
- **04:30 — REST API & OpenAPI**: Inspect `/api/v1/openapi.json` or query `/api/v1/events` using Bearer API keys.
- **04:50 — Embedded Gallery**: Inspect `/embed/events/evt_raptor_2026/gallery` demonstrating seamless iframe embedding without private draft or judge data leakage.

---

## 12. Verification & Testing Commands

Run the complete verification suite locally:

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Unit Tests (26 test files, 162+ tests)
npm run test:unit

# 4. Integration Tests (26 test files, 119+ tests)
npm run test:integration

# 5. Full Vitest Suite (52 test files, 281+ tests)
npm test

# 6. Playwright End-to-End Suite
npm run test:e2e

# 7. Production Build
npm run build
```

## 13. License

RaptorOS is licensed under the **Apache License, Version 2.0**. See the [LICENSE](file:///LICENSE) file for details.
