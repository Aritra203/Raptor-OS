# RaptorOS Threat Model & Security Architecture

This document provides a comprehensive security threat model for **RaptorOS**, analyzing system assets, threat actors, attack vectors, defensive mitigations, and residual risks in accordance with the Dogfood 2026 security criteria.

---

## 1. System Architecture & Trust Boundaries

```
[ Untrusted Public Internet / Local LAN ]
                   │
                   ▼  (Reverse Proxy / HTTPS Gateway)
     ┌───────────────────────────────┐
     │      Next.js App Server       │
     │  - Web Routes (UI & Embed)    │
     │  - REST API v1 (/api/v1)      │
     │  - Public Verification Routes │
     └───────────────┬───────────────┘
                     │
          (Strict Boundary via Event RBAC)
                     │
     ┌───────────────▼───────────────┐
     │     Domain Service Layer      │
     │  - Input Validation (Zod)     │
     │  - Normalization Engine       │
     │  - Anti-Abuse & Rate Limiter  │
     │  - Webhook SSRF Guard         │
     └───────────────┬───────────────┘
                     │
           (Prisma ORM Boundary)
                     │
     ┌───────────────▼───────────────┐
     │      PostgreSQL Database      │
     │  - Foreign Key Constraints    │
     │  - Multi-Column Uniqueness    │
     │  - Immutable History Records  │
     └───────────────────────────────┘
```

---

## 2. Threat Actors & Capabilities

| Threat Actor | Capabilities & Assumptions | Motivation |
|---|---|---|
| **Anonymous Attacker** | Network access to public routes, port scanning, crafted HTTP payloads, credential stuffing. | Disrupt event, exfiltrate private drafts/scores, forge certificates. |
| **Malicious Participant** | Authenticated account, registered in event, team member. | Self-vote, vote multiple times, tamper with other teams' submissions, submit past deadline. |
| **Rogue / Biased Judge** | Authenticated judge role. Access to assigned projects. | Inflate friendly projects, sabotage competitors, discover identities of peer judges. |
| **Compromised Organizer** | Authenticated organizer role within a specific event. | Exfiltrate server secrets, abuse webhooks to probe internal infrastructure (SSRF). |
| **Network Eavesdropper** | Passive observer on unencrypted networks (e.g. hackathon WiFi). | Intercept session cookies or API keys. |

---

## 3. Comprehensive Asset & Threat Matrix

### 3.1. Credentials & Password Hashes
- **Asset**: User credentials, password storage, authentication database.
- **Threat**: Credential stuffing, brute force, offline rainbow table attacks against dumped database.
- **Attack Surface**: `/api/auth/register`, `/api/auth/login`.
- **Mitigation**:
  - Memory-hard **scrypt** key derivation ($N=16384, r=8, p=1$) per OWASP recommendations.
  - 16-byte cryptographically secure random salt generated per user via `crypto.randomBytes`.
  - Constant-time verification (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
  - Client IP + email rate limiting (5 failed attempts per 15 minutes).
  - Passwords and raw hashes are strictly excluded from DTOs (`SafeUser` sanitization).
- **Residual Risk**: User choosing weak passwords; mitigated by minimum 8-character and complexity requirements.

---

### 3.2. Sessions & Authentication Tokens
- **Asset**: User login sessions, active tokens, authentication state.
- **Threat**: Session hijacking, token replay, token prediction, XSS-driven token exfiltration.
- **Attack Surface**: Cookie headers, session validation middleware.
- **Mitigation**:
  - 256 bits of cryptographic entropy (`crypto.randomBytes(32)`).
  - Raw session tokens are **never stored in the database**; only SHA-256 digests are persisted.
  - Cookies configured with `HttpOnly = true`, `SameSite = Lax`, `Path = /`, and `Secure = true` in production.
  - Absolute session expiration (7 days) with database-level revocation on logout (`deleteMany`).
- **Residual Risk**: Stolen session cookie from physical machine access prior to expiration.

---

### 3.3. Event-Scoped RBAC & IDOR Prevention
- **Asset**: Event configurations, private drafts, judge assignments, unreleased scores.
- **Threat**: Insecure Direct Object References (IDOR), horizontal/vertical privilege escalation across events.
- **Attack Surface**: `/api/events/[eventId]/*`, `/api/v1/events/[eventId]/*`.
- **Mitigation**:
  - **Zero Global Roles**: RaptorOS explicitly eliminates global `User.role`. Every authorization decision requires an explicit tuple: `(userId, eventId, role)`.
  - Server-side enforcement via `requireEventRole(eventId, allowedRoles)` on every mutation and private query.
  - Multi-tenant foreign key scoping: All database queries filter by both `id` AND `eventId`.
  - Isolation tests: Automated integration suite verifies that Organizers in Event A cannot read, edit, or delete entities in Event B.
- **Residual Risk**: Application logic bug if an endpoint forgets to pass `eventId` to the repository; mitigated by 100% endpoint test coverage.

---

### 3.4. Cross-Site Request Forgery (CSRF)
- **Asset**: State-changing actions (creating events, submitting projects, casting votes, publishing results).
- **Threat**: Malicious third-party website submitting unauthorized actions on behalf of an authenticated user.
- **Attack Surface**: Browser form submissions and fetch requests.
- **Mitigation**:
  - Session cookies enforce `SameSite = Lax`, blocking cross-origin POST requests in modern browsers.
  - REST API v1 uses `Authorization: Bearer <token>` or API key headers, which browsers never automatically attach across origins.
  - Custom header validation on sensitive Next.js route handlers.
- **Residual Risk**: Legacy browsers lacking RFC 6265bis SameSite compliance.

---

### 3.5. Cross-Site Scripting (XSS)
- **Asset**: Authenticated user sessions, DOM integrity, gallery view.
- **Threat**: Injected malicious JavaScript executing in other users' or judges' browsers.
- **Attack Surface**: Submission titles, descriptions, markdown content, comments, team names.
- **Mitigation**:
  - React/JSX auto-escapes all text nodes by default.
  - Comments sanitized via strict allowlist parsing (`sanitizeCommentContent`), disallowing raw HTML tags (`<script>`, `<iframe>`, `<img>`, `onload`, `onerror`).
  - Markdown rendered with strict sanitizer forbidding dangerous URI schemes (`javascript:`, `data:`).
  - Output encoding in CSV and JSON exports.
- **Residual Risk**: DOM-based XSS if third-party libraries mutate DOM unsafely; minimized by zero external UI runtime dependencies.

---

### 3.6. Community Voting & Sybil Manipulation
- **Asset**: Public choice awards, community vote tallies.
- **Threat**: Vote stuffing, self-voting, voting for disqualified projects, automated bot voting.
- **Attack Surface**: `POST /api/events/[eventId]/community/votes`.
- **Mitigation**:
  - **Rule A (One Vote per User per Submission)**: Enforced via database compound unique constraint `@@unique([eventId, voterId, submissionId])`.
  - Self-voting prevention: Server-side check verifies voter is not creator or member of the target team.
  - Voting window enforcement: Server rejects votes cast before `votingStart` or after `votingEnd`.
  - Sliding-window velocity tracking and abuse signal logging (e.g. `RAPID_VOTE_VELOCITY`, `SELF_VOTE_ATTEMPT`).
  - Hidden counts: Vote tallies remain hidden from participants and public until organizer explicitly sets `resultsPublished = true`.
- **Residual Risk**: Collusion between different teams voting for each other; mitigated by fairness analytics and organizer review.

---

### 3.7. Webhook Infrastructure & SSRF (Server-Side Request Forgery)
- **Asset**: Internal network topology, Docker network services, cloud metadata endpoints.
- **Threat**: Malicious organizer configuring a webhook to probe internal network (`127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, `postgres:5432`).
- **Attack Surface**: Webhook destination URL registration and automated dispatch.
- **Mitigation**:
  - **Strict SSRF Validator (`lib/security/ssrf.ts`)**:
    - Unconditional blocking of cloud metadata IPs (`169.254.169.254`, `metadata.google.internal`).
    - Blocking of RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
    - Blocking of loopback addresses (`127.0.0.0/8`, `::1`, `localhost`).
    - Blocking of internal container hostnames (`postgres`, `db`, `host.docker.internal`).
    - Blocking of sensitive infrastructure ports (22, 25, 5432, 6379, etc.).
    - Supported exception via `RAPTOR_ALLOW_LOCAL_WEBHOOKS=true` only for isolated local testing.
  - **HMAC-SHA256 Signatures**: Every payload signed with a 256-bit secret, delivered via `X-RaptorOS-Signature`.
  - **At-Least-Once Semantics**: Asynchronous delivery with unique delivery ID (`del_<uuid>`), bounded retries, and offline failure absorption.
- **Residual Risk**: DNS rebinding on public domains resolving to private IPs; mitigated by hostname validation and short timeout budgets.

---

### 3.8. Cryptographic Keys & Ed25519 Judge Records
- **Asset**: Evaluation integrity, judge scores authenticity, server private signing key.
- **Threat**: Forgery of judge evaluation certificates, leakage of Ed25519 private key, unmasking of judge identities.
- **Attack Surface**: `/api/v1/public-key`, `/api/v1/events/[eventId]/judging/records`.
- **Mitigation**:
  - Ed25519 asymmetric cryptography: Server signs canonical JSON evaluations.
  - Canonicalization: RFC 8785 compliant recursive key sorting guaranteeing deterministic byte serialization.
  - **Key Separation**: Private key stored exclusively in protected `SystemSetting` table, never exposed via any API, log, or export.
  - Public key exposed via `/api/v1/public-key` in standard SPKI PEM format.
  - **Judge Pseudonymization**: HMAC-SHA256 irreversible masking (`Judge-<8hex>`) prevents public unmasking of evaluator identities.
- **Residual Risk**: Direct read access to the database by server root admin; standard for self-hosted deployments.

---

### 3.9. Certificates & Verification
- **Asset**: Hackathon award and participation credentials.
- **Threat**: Certificate forgery, enumeration of valid certificate IDs, unauthorized generation.
- **Attack Surface**: `/verify/certificate/[code]`, `/api/v1/events/[eventId]/certificates`.
- **Mitigation**:
  - Cryptographically unpredictable verification IDs (`RAPTOR-CERT-YYYY-<TYPE>-<RANDOM12HEX>`) with 48 bits of entropy per certificate.
  - Server-side eligibility engine: Verifies user was registered, team submitted project, or judge completed assignments.
  - Public verification endpoint is strictly read-only and rate-limited to prevent brute-force enumeration.
  - Revocation handling: Revoked certificates clearly display `REVOKED` status, timestamp, and audit reason.
- **Residual Risk**: Social engineering of event organizers to issue fraudulent awards.

---

### 3.10. CSV Import / Export & Injection
- **Asset**: Participant database, external spreadsheet tools.
- **Threat**: CSV Formula Injection (`=CMD|...`, `@SUM(...)`, `-2+3`), malformed data corruption.
- **Attack Surface**: `/api/v1/events/[eventId]/import`, `/api/v1/events/[eventId]/export/*`.
- **Mitigation**:
  - RFC 4180 strict CSV parser with row-by-row Zod schema validation.
  - CSV export sanitizes cell values starting with `=`, `+`, `-`, `@`, `\t`, `\r` by prepending a single quote `'` to neutralize formula execution in Excel/Calc.
  - Transactional imports: Validates all records before database persistence.
- **Residual Risk**: User opening exported CSV in misconfigured spreadsheet viewer ignoring RFC standards.

---

### 3.11. Public Gallery Embedding
- **Asset**: Public gallery view embedded in third-party sponsor/community websites.
- **Threat**: Clickjacking, framing attacks, private score/draft leakage into embed.
- **Attack Surface**: `/embed/events/[eventId]/gallery`.
- **Mitigation**:
  - Embed endpoint strictly excludes unfinalized drafts (`DRAFT`), disqualified projects (`DISQUALIFIED`), judge scores, and internal rubrics.
  - Framed content served with `Content-Security-Policy: frame-ancestors *` (for intentional embedding) while restricting script privileges.
- **Residual Risk**: Sponsor website hosting the iframe could overlay deceptive UI; mitigated by origin transparency.

---

## 4. Residual Risk Summary & Operational Recommendations

1. **Production Reverse Proxy**: In production self-hosted deployments, RaptorOS should sit behind a TLS-terminating reverse proxy (Nginx, Caddy, or Traefik) enforcing HTTPS and HSTS.
2. **Database Access Restriction**: PostgreSQL port 5432 should bind only to the Docker internal network or `localhost`, never to public interfaces (`0.0.0.0`).
3. **Offline Integrity**: Since RaptorOS requires zero external network connections, it can operate in air-gapped or isolated local networks with zero loss of functionality.
