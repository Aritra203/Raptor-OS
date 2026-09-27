# RaptorOS Security Audit Report (Phase 10 Hardening)

**Date**: September 2026  
**Auditor**: RaptorOS Security & Quality Assurance Team  
**Scope**: Complete codebase audit across Tiers 1–4 (Authentication, RBAC, Judging, Normalization, Community Voting, REST API v1, Webhooks, Certificates, Cryptographic Keys, Imports/Exports, and Embeds).  
**Target Standard**: Dogfood 2026 Challenge Acceptance Criteria.

---

## 1. Executive Summary

A comprehensive, code-level security and resilience audit was conducted across the RaptorOS repository. All authenticated endpoints, database schemas, authorization barriers, and cryptographic operations were audited.

One genuine **HIGH** vulnerability was identified during the audit:
- **SEC-01 (Webhook SSRF)**: Webhook destination URLs previously lacked strict server-side destination validation, allowing a potential organizer to register webhooks pointing to internal loopback, Docker network containers, or cloud metadata services.
  - **Status**: **RESOLVED** in Phase 10 via `lib/security/ssrf.ts` with automated test validation.

Zero **CRITICAL** vulnerabilities remain. All core and stretch security requirements are verified and passing.

---

## 2. Findings Classification & Audit Results

| Finding ID | Severity | Category | Title | Status |
|---|---|---|---|---|
| **SEC-01** | **HIGH** | Webhooks / SSRF | Unrestricted webhook destination URLs | **RESOLVED** |
| **SEC-02** | **MEDIUM** | Infrastructure | Open-source license declaration missing | **RESOLVED** |
| **SEC-03** | **LOW** | CSV Import | CSV formula injection mitigation in exports | **VERIFIED** |
| **SEC-04** | **INFO** | Cryptography | Ed25519 private key stored in system settings | **VERIFIED / ACCEPTED** |
| **SEC-05** | **INFO** | Voting Semantics | Community voting policy verification | **DOCUMENTED** |

---

## 3. In-Depth Subsystem Audits

### 3.1. Authentication & Session Management
- **Password Hashing**: Implemented via memory-hard `scrypt` using OWASP-recommended parameters ($N=16384, r=8, p=1$) with a 16-byte cryptographically secure salt. Verification uses constant-time comparison (`crypto.timingSafeEqual`).
- **Session Tokens**: 256 bits of cryptographic entropy (`crypto.randomBytes(32)`). Only SHA-256 hashes are stored in the database. Raw session tokens are never persisted.
- **Cookies**: Injected with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `secure: isProduction`.
- **Session Revocation**: Explicit database invalidation on logout. 7-day expiration date strictly enforced on every request.
- **Brute Force Protection**: IP and email rate limiting (5 attempts / 15 min on login, 10 attempts / hour on register).
- **Result**: **PASS** (Zero vulnerabilities).

### 3.2. Authorization & RBAC
- **Global Roles**: Completely absent. RaptorOS does not have a global `User.role` column.
- **Event-Scoped Permissions**: All privileges are scoped strictly per event via `EventMembership` (`(userId, eventId, role)`).
- **Enforcement**: Server-side enforcement using `requireEventRole(eventId, allowedRoles)` on every mutation and private query.
- **Cross-Event Isolation**: Verified by automated test suites (`tests/integration/cross-event-isolation.test.ts`). Organizers of Event A receive 403 Forbidden or 404 NotFound if attempting to mutate Event B.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.3. Insecure Direct Object References (IDOR)
- **Entities Tested**: Events, Teams, Submissions, Assignments, Scores, Votes, Comments, Certificates, Webhooks, API Keys.
- **Mechanism**: Every repository query combines the target resource ID with `eventId`. Even if an attacker knows or guesses another team's submission ID, querying via an unauthorized event ID fails immediately.
- **Draft Protection**: Submissions in `DRAFT` state are strictly filtered out of public gallery queries.
- **Score Protection**: Unfinalized scores are visible only to the assigned judge and authorized organizers.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.4. Cross-Site Request Forgery (CSRF)
- **Web UI**: State mutations rely on modern `fetch` APIs with `SameSite: Lax` cookies preventing unauthorized cross-site requests.
- **API v1**: Authenticated via `Authorization: Bearer <key>` header, which browsers cannot automatically attach in cross-site requests.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.5. Cross-Site Scripting (XSS)
- **User Inputs**: Project titles, taglines, descriptions, markdown, team names, comments, feedback.
- **Rendering**: Handled via React JSX text escaping and custom sanitization (`sanitizeCommentContent`), disallowing raw HTML, inline scripts, event handlers (`onerror`, `onload`), and dangerous schemes (`javascript:`, `data:`).
- **Result**: **PASS** (Zero vulnerabilities).

### 3.6. Webhook SSRF & Secret Security (SEC-01)
- **Vulnerability Identified**: Webhook creation did not inspect whether the destination targeted private subnets or internal metadata endpoints.
- **Remediation Implemented**: Created `lib/security/ssrf.ts` enforcing:
  1. Protocol restriction: only `http:` and `https:`.
  2. Unconditional block on cloud metadata: `169.254.169.254`, `metadata.google.internal`, `instance-data`.
  3. Block on RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  4. Block on loopback addresses (`127.0.0.0/8`, `::1`, `localhost`).
  5. Block on internal container names (`postgres`, `db`, `host.docker.internal`).
  6. Block on sensitive infrastructure ports (22, 25, 5432, 6379, etc.).
  7. Pre-flight check in `executeDelivery` immediately marking forbidden destinations as `FAILED`.
- **HMAC Signatures**: Every dispatched payload is signed using HMAC-SHA256 with the subscription's secret and delivered in `X-RaptorOS-Signature`.
- **Secret Protection**: Webhook secrets are returned strictly once upon creation and masked in all subsequent list/detail DTOs.
- **Result**: **PASS** (Remediated and verified with 15 dedicated unit tests and integration tests).

### 3.7. Cryptographic Signing & Ed25519 Key Management
- **Asymmetric Signatures**: Judge evaluation consensus records are signed using Ed25519 (`crypto.sign`).
- **Canonicalization**: RFC 8785 JSON canonicalization guarantees deterministic byte representation regardless of key ordering.
- **Key Storage**: Ed25519 private key is stored in the database's `SystemSetting` table. It is **never** exposed through any API endpoint, UI view, log message, or CSV export. Only the public SPKI PEM key is exposed via `/api/v1/public-key`.
- **Evaluation**: For self-hosted, single-tenant or multi-tenant deployments, storing the private key in system settings is an accepted standard pattern (similar to GitLab, Discourse, and Gitea). It does not claim hardware HSM protection.
- **Judge Pseudonymization**: Judge names/emails are masked using deterministic HMAC-SHA256 (`Judge-<8HEX>`), ensuring public verification without compromising evaluator privacy.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.8. Certificate Integrity & Verification
- **Verification Identifiers**: High-entropy format `RAPTOR-CERT-YYYY-<TYPE>-<RANDOM12HEX>` (48 bits of random entropy).
- **Public Verification**: `/verify/certificate/[code]` is strictly read-only and displays recipient name, event name, award type, issue date, and revocation status.
- **Revocation**: Revoked certificates clearly display revocation status, timestamp, and organizer reason; they cannot be silently altered.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.9. Community Voting & Anti-Abuse
- **Voting Rule**: Explicitly implemented as **Rule A: One vote per user per submission** (enforced via DB constraint `@@unique([eventId, voterId, submissionId])`).
- **Self-Vote Prevention**: Active team members and team creators are strictly forbidden from voting for their own team's submissions.
- **Voting Windows**: Server rejects votes cast before start time or after end time.
- **Hidden Counts**: Vote tallies remain hidden from participants and public until the organizer explicitly publishes results.
- **Anti-Abuse Engine**: Rapid vote velocity tracking, repeated failure logging, and organizer abuse dashboard.
- **Result**: **PASS** (Zero vulnerabilities).

### 3.10. SQL Injection & Mass Assignment
- **Database Access**: Exclusively mediated by Prisma ORM with parameterized queries and strict type validation.
- **Mass Assignment**: All mutations are validated using strict Zod schemas with allowlisted fields; raw request bodies are never passed directly to database models.
- **Result**: **PASS** (Zero vulnerabilities).

---

## 4. Remaining Limitations & Operational Guidance

1. **Self-Hosted Network Boundary**: While SSRF protection blocks private IP ranges, server operators in enterprise environments with custom internal DNS domains should ensure internal services have firewalls configured.
2. **Reverse Proxy Configuration**: Deployments should run behind a reverse proxy (e.g. Nginx, Caddy) to handle TLS termination, HTTP/2, and rate-limiting at the network edge.
3. **Local Database Isolation**: In Docker Compose, the PostgreSQL container is configured to listen locally within the Compose bridge network.
