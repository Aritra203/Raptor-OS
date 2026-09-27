# RaptorOS Community Voting, Comments & Anti-Abuse Specification

## 1. Overview & Architectural Principles

Phase 8 introduces **Community Voting, Submission Comments, and Anti-Abuse Heuristics** to RaptorOS while maintaining 100% offline self-containment, absolute auditability, and complete architectural isolation from official judging.

### 1.1 Core Invariants

1. **Strict Separation of Scoring**: Community votes **never** mutate, influence, or merge into Phase 6/7 judge scoring (`Score`, `ScoreItem`, `NormalizedScore`, `ResultSnapshot`, or official awards). Community Choice awards are distinct, non-destructive public signals.
2. **Deterministic & Concurrency-Safe**: One-person/one-vote guarantees are enforced at the database level (`@@unique([eventId, voterId, submissionId])`). Concurrent attempts produce deterministic HTTP `409 Conflict` responses without phantom increments.
3. **Non-Destructive Anti-Abuse**: Heuristic velocity monitors and rate limiters flag anomalies into an organizer `AbuseSignal` review queue. Automated heuristics **never** silently delete, discard, or invalidate votes without human organizer discretion.
4. **Information Leakage Prevention**: Live vote counts and rankings remain strictly hidden from unauthenticated visitors and participants until an organizer explicitly publishes community results.
5. **Sanitized Plain-Text Discussion**: Comments are strictly sanitized to plain text (2–1000 characters). HTML tags, markdown execution vectors, script payloads, and control characters are stripped prior to persistence.
6. **Zero External Dependencies**: Operates entirely in self-hosted, air-gapped, or LAN environments without external captcha services, cloud telemetry, or third-party moderation APIs.

---

## 2. Community Voting System

### 2.1 Voting Lifecycle & Configuration (`VotingConfig`)

Every event maintains an independent `VotingConfig` record created automatically upon event provisioning or updated via the organizer console:

| Field | Type | Default | Description |
|---|---|---|---|
| `isEnabled` | Boolean | `false` | Master switch controlling whether voting is accepted. |
| `votingStart` | DateTime? | `null` | Optional ISO timestamp when voting opens. |
| `votingEnd` | DateTime? | `null` | Optional ISO timestamp when voting closes. |
| `eligibilityMode` | Enum | `EVENT_PARTICIPANTS` | Access control tier (`ALL_AUTHENTICATED`, `EVENT_PARTICIPANTS`). |
| `allowParticipantVotes` | Boolean | `true` | Allows registered participants to cast votes. |
| `allowJudgeVotes` | Boolean | `true` | Allows event judges to participate in community voting. |
| `allowOrganizerVotes` | Boolean | `false` | Controls whether organizers can participate in voting. |
| `allowSelfVoting` | Boolean | `false` | Prohibits team members from voting for their own submissions. |
| `publicVoteCounts` | Boolean | `false` | Controls whether live vote totals are publicly visible on gallery cards. |
| `resultsPublished` | Boolean | `false` | Master visibility flag for public community leaderboards and final totals. |
| `randomizeGalleryOrder` | Boolean | `false` | Applies deterministic seeded shuffling to prevent top-row bias. |
| `galleryRandomSeed` | Int? | `1337` | Numeric seed integer for reproducible gallery permutations. |

### 2.2 Eligibility Modes & Vote Uniqueness

- `ALL_AUTHENTICATED`: Any authenticated RaptorOS user may cast a vote.
- `EVENT_PARTICIPANTS`: Voter must hold an active `EventMembership` for the given event.
- **Vote Uniqueness Constraint**: Enforced at the database level via `@@unique([eventId, voterId, submissionId])`. Each voter may cast one vote per project. Repeated ballots for the same project are rejected with HTTP `409 Conflict`. Voters may retract their vote at any time while voting remains open.

### 2.3 Self-Voting Prevention

When `allowSelfVoting: false` (default), `CommunityService.castVote` queries the submission's associated team and verifies that the voter's `userId` is neither the team creator nor any listed `TeamMember`. If detected, the ballot is rejected with HTTP `403 Forbidden`.

### 2.4 Vote Retraction (`DELETE`)

If `allowVoteRetraction: true` and the voting window remains active, voters may cancel an existing ballot via `DELETE /api/events/:eventId/submissions/:submissionId/vote`. Retraction:
1. Deletes the `Vote` row atomically.
2. Appends an immutable audit log entry: `VOTE_RETRACTED`.
3. Does not trigger rate penalty cooldowns, enabling participants to redirect their vote to another team.

---

## 3. Comments & Moderation Engine

### 3.1 Plain-Text Sanitization (`comment-sanitizer.ts`)

To completely eliminate Stored XSS vectors in offline environments without hefty external sanitizer libraries, all comment inputs undergo strict character and structural sanitization:

1. **Tag & Entity Stripping**: All HTML tags (`<script>`, `<iframe>`, `<a>`, `<div>`, etc.) and escaped entity artifacts are stripped.
2. **Line Ending Normalization**: All `\r\n` and `\r` occurrences are normalized to standard Unix `\n`.
3. **Control Character Elimination**: Non-printable control characters (ASCII `\x00-\x08`, `\x0B-\x0C`, `\x0E-\x1F`, `\x7F`) are removed.
4. **Length Enforcement**: Must contain between 2 and 1,000 non-whitespace characters.
5. **Display Rendering**: Client components render comment bodies strictly within standard `<p>` or `<span>` elements with CSS `whitespace-pre-wrap`, ensuring no DOM parsing occurs.

### 3.2 Moderation States (`CommentModerationStatus`)

Comments support three operational states:
- `PUBLISHED`: Normal state, rendered in the public project discussion feed.
- `HIDDEN`: Temporarily masked from public view pending organizer review.
- `REMOVED`: Permanently withdrawn from public display with reason recorded.

### 3.3 Organizer Moderation Workflow

Organizers inspect comments across the event via the **Comments Moderation** tab in the management console:
- Quick actions: **Hide**, **Remove**, or **Restore to Published**.
- Action records the organizer's `userId`, timestamp `moderatedAt`, and an optional `moderationReason`.
- Writes an immutable `COMMENT_MODERATED` entry to `AuditLog`.

---

## 4. Anti-Abuse & Anomaly Detection

### 4.1 In-Memory Sliding-Window Rate Limiting

RaptorOS deploys an in-memory sliding-window log rate limiter (`AntiAbuseService`):

| Action | Limit | Window | Exceeded Response |
|---|---|---|---|
| **Vote Casting** | 5 actions | 60 seconds | `429 Too Many Requests` (`Retry-After: 60`) |
| **Comment Posting** | 3 actions | 60 seconds | `429 Too Many Requests` (`Retry-After: 60`) |

### 4.2 Automated Heuristic Velocity Monitors

Beyond immediate rate rejection, `AntiAbuseService` tracks velocity patterns across sliding intervals:
- **Vote Burst Anomaly**: When an individual voter attempts >10 votes in 5 minutes, or a submission receives >20 votes within 2 minutes.
- **Comment Velocity Anomaly**: When a user submits rapid comments across multiple projects within 2 minutes.
- **Unauthorized Probing**: Repeated 403/400 validation failures from the same client IP or user session.

### 4.3 Anomaly Queue (`AbuseSignal`)

Detected velocity spikes generate an `AbuseSignal` record:
- **Severity**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Status**: `PENDING_REVIEW`, `DISMISSED`, `CONFIRMED_ABUSE`.
- **Metadata**: JSON payload detailing client IP, user agent, timestamps, and velocity delta.

Organizers review signals in the **Abuse Signals** tab of the management console, where they can mark items as dismissed or confirmed abuse with audit notes.

---

## 5. Gallery Exposure Bias Mitigation

To counter primacy bias (where top-listed submissions receive disproportionately more votes), the public gallery implements **Deterministic Seeded Pseudo-Random Shuffling**:

1. If `randomizeGallery: true`, the server computes a deterministic 32-bit Murmur-inspired hash from `eventId + gallerySeed + submissionId`.
2. Sort ordering uses:
   ```typescript
   ORDER BY hash(submissionId, seed) ASC
   ```
3. **Pagination Invariant**: Because the hash is deterministic for any given seed, page transitions (`?page=1`, `?page=2`) never produce duplicate or skipped items across pages.
4. Organizers can cycle the `gallerySeed` daily, per voting round, or whenever re-randomization is desired.

---

## 6. Threat Model & Security Posture

| Threat Vector | Mitigation Strategy |
|---|---|
| **Vote Flooding / Sybil Attack** | Eligibility restricted to `REGISTERED_PARTICIPANTS` or `SUBMITTING_TEAMS_ONLY`. Database uniqueness constraint `(eventId, voterId, submissionId)` eliminates multi-voting. In-memory sliding rate limiter rejects bursts. |
| **Stored XSS via Comments** | Zero HTML parser execution. Tag stripping sanitizer removes all markup. Plain-text rendering in React DOM prevents script execution. |
| **CSRF & Origin Spoofing** | SameSite session cookies coupled with server-side Origin / Referer validation (`lib/utils/csrf.ts`). |
| **Exposure Bias / Vote Gaming** | Seeded deterministic gallery permutation distributes participant visibility equally across all teams. |
| **Bandwidth Exhaustion / DoS** | Strict payload caps (1000 chars per comment), sliding window rate limiting with HTTP 429 status and `Retry-After` header. |
| **Vote Tampering / Judge Coercion** | Community voting data lives exclusively in `Vote` and `VotingConfig`. Normalization algorithms in Phase 7 execute against immutable `Score` tables with zero connection to community ballots. |
