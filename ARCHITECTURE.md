# RaptorOS Architecture Document

## 1. Architectural Philosophy: Modular Monolith

RaptorOS is architected as a **modular monolith**. We explicitly reject premature microservices, message buses (Kafka/RabbitMQ), and distributed caching (Redis). 

A hackathon platform operates in environments where network isolation, rapid deployment, deterministic operations, and zero operational overhead are paramount. A well-factored monolith deployed as a single container (paired with PostgreSQL) provides:

- Single-command orchestration (`docker compose up`).
- Transactional consistency via PostgreSQL ACID transactions.
- In-process function calls instead of network hops.
- Clear module boundaries that can be refactored or extracted if ever needed in the distant future.

---

## 2. Layered Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   (Next.js App Router, React Server Components, UI)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                        API Layer                       │
│    (Next.js Route Handlers: /api/..., Zod Validation)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                      Service Layer                     │
│    (Domain Logic, Workflow Orchestration, Rules)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Repository Layer                    │
│    (Prisma Queries, Data Mapping, Transactions)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Persistence Layer                   │
│            (PostgreSQL 16 Engine & Storage)            │
└────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Presentation Layer (`app/`, `components/`)**:
   - Renders HTML and client interactivity.
   - Client components never import Prisma or database drivers.
   - Interacts with backend via React Server Components (direct service invocation) or Route Handlers (`fetch("/api/...")`).

2. **API Layer (`app/api/...`)**:
   - Validates external incoming HTTP requests via Zod.
   - Delegates business execution to domain services.
   - Catches all exceptions and normalizes them using `formatErrorResponse()` to prevent leakage of credentials or SQL errors.

3. **Service Layer (`server/services/...`)**:
   - Contains pure business rules, validation workflows, and domain calculations (e.g., score normalization).
   - Coordinates multi-repository interactions within a single transactional unit when necessary.

4. **Repository Layer (`server/repositories/...`)**:
   - Sole interface to Prisma ORM.
   - Encapsulates database queries, aggregations, and upserts.
   - Translates raw database exceptions into typed application errors (`DatabaseError`).

5. **Infrastructure & Shared Layer (`lib/...`)**:
   - **`lib/db/prisma.ts`**: Global Prisma client singleton. Handles connection pooling and prevents hot-reload connection leaks.
   - **`lib/env/env.ts`**: Strict Zod schema validating environment variables at boot time.
   - **`lib/errors/app-error.ts`**: Typed error taxonomy (`AppError`, `DatabaseError`, `ValidationError`, `NotFoundError`).
   - **`lib/logger/logger.ts`**: Contextual logger with automatic redaction of passwords, tokens, and database URLs.

---

## 3. Phase 2 Domain Architecture Invariants

Phase 2 establishes the complete production-ready domain and persistence layer for the hackathon lifecycle. It enforces four primary guarantees:

### 3.1 Event-Scoped Authorization & Roles
Users (`User`) represent human identities. Business roles (`PARTICIPANT`, `JUDGE`, `ORGANIZER`, `ADMIN`) are strictly event-scoped via `EventMembership`.
- A user can organize Event 1 while competing as a participant in Event 2.
- No global `User.role` column exists, preventing authorization privilege escalation across multiple hackathons.

### 3.2 Immutability & Reproducibility
- **Versioned Rubrics**: When judges evaluate projects, scores reference a specific `RubricVersion`. Modifying criteria in later rounds does not invalidate historical evaluations.
- **Raw Scores**: `Score` and `ScoreItem` store raw, un-calibrated judge grades. These records are never overwritten.
- **Normalization Runs**: Calibration runs (`NormalizationRun`, `NormalizedScore`) are computed in separate audit-logged batches. Organizers can execute multiple normalization algorithms (e.g. Z-Score vs. Min-Max) without altering the underlying raw evidence.

### 3.3 Multi-Event Isolation
- Slugs for tracks and teams are scoped to the event via compound uniqueness (`@@unique([eventId, slug])`).
- Submissions are uniquely constrained per team per event (`@@unique([eventId, teamId])`).
- All queries partition data by `eventId` to prevent cross-tenant data leaks.

### 3.4 Referential Integrity & Deletion Policies
- Deletion of records with active dependencies is safeguarded:
  - Scored submissions cannot be deleted (`onDelete: Restrict`).
  - Rubric versions linked to scores cannot be deleted (`onDelete: Restrict`).
  - Judges who have submitted scores cannot be deleted (`onDelete: Restrict`).
  - Certificate recipients cannot be deleted (`onDelete: Restrict`).
  - Cascade deletions are restricted to parent-child containment (e.g. deleting an unstarted event cascades its tracks and prizes).

---

---

## 4. Phase 3 Authentication & Event-Scoped RBAC Architecture

Phase 3 implements self-contained, offline-first authentication, cryptographic session management, and event-scoped role-based access control.

### 4.1 Cryptographic Password Hashing
- Node.js built-in `crypto.scrypt` is used for password hashing with OWASP-recommended parameters ($N=16384, r=8, p=1$, 64-byte key).
- Each user receives an independent 16-byte cryptographically secure random salt.
- Passwords are verified via `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- Plaintext passwords and derived hashes are completely excluded from `SafeUser` sanitization, server logs, and API payloads.

### 4.2 Session Token Hashing & Cookie Security
- Sessions generate a 32-byte cryptographic random token (64 hex characters).
- **Zero Token Leakage in DB**: The database stores only `tokenHash = SHA256(rawToken)`. Even a direct database dump cannot reveal usable session tokens.
- Raw session tokens reside exclusively in `HttpOnly`, `SameSite=Lax`, `Path=/` cookies (`raptoros_session`).
- Sliding window expiration (7 days) with session revocation on logout.

### 4.3 Event-Scoped RBAC Enforcement
- Authorization helpers (`server/auth/authorization.ts`) decouple identity from authority:
  - `requireUser()`: Ensures valid session.
  - `requireEventMember(eventId)`: Ensures user is enrolled in event.
  - `requireEventRole(eventId, roles)`: Ensures user has specific role (`ADMIN`, `ORGANIZER`, `JUDGE`, `PARTICIPANT`) within that specific event.
- Prevents cross-event privilege escalation.

### 4.4 Brute-Force & Enumeration Defenses
- In-memory sliding-window rate limiting on login (5 attempts / 15m) and registration (10 attempts / 1h).
- Timing attack mitigation: Failed login attempts execute constant-time dummy scrypt derivation and return identical generic error messages.

### 4.5 Team Invitation Token Hashing
- Team invitations use cryptographically secure 32-byte raw hex tokens.
- Similar to session tokens, the database stores only `tokenHash = SHA256(rawToken)`.
- Prevents database dumps from exposing usable invitation tokens.

---

## 5. Event Lifecycle & Team Workflows Architecture (Phase 4)

### 5.1 Server-Side Event State Machine
- Events progress through 9 explicit lifecycle states: `DRAFT` -> `REGISTRATION_OPEN` -> `REGISTRATION_CLOSED` -> `SUBMISSIONS_OPEN` -> `SUBMISSIONS_CLOSED` -> `JUDGING_OPEN` -> `JUDGING_CLOSED` -> `RESULTS_PUBLISHED` -> `ARCHIVED`.
- Invalid transitions are rejected at the service layer via `LEGAL_EVENT_TRANSITIONS`.
- Every lifecycle change is logged to the `AuditLog` table with user identity and timestamp.

### 5.2 Team Formation Rules & Capacity Bounds
- Enforces single-team-per-event invariant per participant.
- Enforces min/max team roster capacity (e.g., 1–4 members) at creation and invitation acceptance.
- Automatic captain succession: Leaving captain transfers leadership to the next active member, or disbands the team if sole member.
- Member removal is restricted exclusively to the team Captain.

---

## 6. Frontend / Backend Separation & Boundaries

- **No Server Leakage**: Server code in `server/` and `lib/db/` is isolated from client bundles. Next.js ensures server modules are never bundled into client JavaScript.
- **Client Safety**: Only variables explicitly prefixed with `NEXT_PUBLIC_` are accessible on the client side. Accessing `getServerEnv()` from client components throws an immediate exception.
- **Offline Typography**: No external Google Fonts, CDNs, or remote assets. High-quality system font stacks and bundled SVGs are used exclusively.

---

## 7. API Versioning Strategy

- `/api/health` serves as the orchestrator and Docker diagnostics endpoint.
- Business APIs in Phase 3+ adopt standard URL path versioning:
  ```
  /api/auth/...
  /api/events/...
  /api/teams/...
  /api/invitations/...
  /api/submissions/...
  /api/judging/...
  ```
- All endpoints adhere to the standardized JSON envelope:
  - **Success**: `{ data: T, meta?: Record<string, unknown> }`
  - **Error**: `{ error: { code: string, message: string, details?: Record<string, unknown> } }`

---

## 8. API-First & Service Architecture

RaptorOS strictly follows an API-First architecture where both the Web UI and the public REST API v1 consume the exact same underlying Domain Services. Business logic is never duplicated in route handlers or client controllers.

```
┌───────────────────────────┐         ┌───────────────────────────┐
│     Web UI Interface      │         │   REST API v1 (/api/v1)   │
│ (React Server Components) │         │ (External Integrators/CLI)│
└─────────────┬─────────────┘         └─────────────┬─────────────┘
              │                                     │
              │       (Shared Authentication)       │
              │  - Session Cookies / Bearer Tokens  │
              │                                     │
              ▼                                     ▼
      ┌─────────────────────────────────────────────────────┐
      │                 Domain Service Layer                │
      │  - EventService         - NormalizationService      │
      │  - TeamService          - ResultsService            │
      │  - SubmissionService    - CommunityService          │
      │  - ScoringService       - WebhookService            │
      │  - RubricService        - CertificateService        │
      │  - AssignmentService    - SignedRecordsService      │
      └──────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
      ┌─────────────────────────────────────────────────────┐
      │                   Repository Layer                  │
      │  - Encapsulated Prisma ORM queries & transactions   │
      └──────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
      ┌─────────────────────────────────────────────────────┐
      │                 PostgreSQL Database                 │
      └─────────────────────────────────────────────────────┘
```

---

## 9. Major Subsystems

1. **Authentication & Session Subsystem**: scrypt password hashing ($N=16384$), 256-bit session token entropy with database SHA-256 digests, HttpOnly/SameSite cookies, zero global roles.
2. **Event & Team Subsystem**: State machine governing lifecycle (`DRAFT` to `ARCHIVED`), single-team-per-event rules, captain authority, and capacity constraints.
3. **Submission Subsystem**: Multi-track submissions, markdown formatting, draft mode, immutable snapshot versions (`SubmissionVersion`), locking and disqualification governance.
4. **Judging & Assignment Subsystem**: Balanced bipartite graph assignment, conflict-of-interest prevention, multi-criteria rubrics, and immutable score records.
5. **Normalization & Fairness Subsystem**: Deterministic Z-score ($50 + 15z$) and Min-Max scaling, population standard deviation convention, safe zero-variance handling, judge calibration severity indicators, and 4-tier tie-breaking.
6. **Results & Snapshot Subsystem**: Snapshot immutability (`DRAFT` -> `FINALIZED` -> `PUBLISHED`), sanitized public leaderboards with zero judge-data leakage.
7. **Community Voting & Anti-Abuse Subsystem**: Rule A (1 vote per user per submission), self-vote blocking, voting windows, hidden counts, and sliding-window velocity rate limiting.
8. **REST API v1 & Security Subsystem**: Bearer API key authentication (`rap_live_...`), standard pagination, OpenAPI 3.1 schema, and strict SSRF destination validation.
9. **Webhooks Subsystem**: HMAC-SHA256 signature verification, unique delivery IDs, offline failure resilience, and bounded retries.
10. **Certificates & Verification Subsystem**: Cryptographically unguessable verification IDs (`RAPTOR-CERT-YYYY-...`), server-side eligibility checks, and public verification portal.
11. **Signed Records Subsystem**: Ed25519 digital signatures on consensus judge evaluations, RFC 8785 canonicalization, and judge pseudonymization.
12. **Import / Export Subsystem**: Strict RFC 4180 CSV parsing, formula injection sanitization, and transactional bulk imports.

---

## 10. Architectural Roadmap & Delivery Status

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Foundation, Docker Compose, Health Check, Node 22 LTS, Pipeline Hardening | **Completed & Audited** |
| **Phase 2** | Complete Database Domain Architecture, Seed, Constraints, Integrity Tests | **Completed & Verified** |
| **Phase 3** | Authentication, Sessions, Event-Scoped RBAC, Account & Navigation UI | **Completed & Verified** |
| **Phase 4** | Event Management, Registration, Team Formation & Invitation Workflows | **Completed & Verified** |
| **Phase 5** | Project Submissions, Versions, Disqualification, Public Gallery Showcase | **Completed & Verified** |
| **Phase 6** | Rubrics, Conflict Detection, Balanced Assignments, Scoring Immutability | **Completed & Verified** |
| **Phase 7** | Normalization Math, Calibration Analytics, Rankings, Snapshots, Public Results | **Completed & Verified** |
| **Phase 8** | Community Voting, Comments, Moderation, Anti-Abuse Heuristics, Gallery Randomization | **Completed & Verified** |
| **Phase 9** | REST API v1, Bearer Keys, Webhooks, HMAC, Certificates, Signed Records, CSV, Embeds | **Completed & Verified** |
| **Phase 10**| Final Hardening, SSRF Protection, Clean Docker & Zero-State Verification, Acceptance Audit | **Completed & Approved** |


