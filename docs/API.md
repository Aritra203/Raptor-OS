# RaptorOS REST API v1 Specification

## 1. Overview & Architecture

RaptorOS provides a comprehensive, versioned, programmatic REST API under the `/api/v1` prefix. The REST API exposes identical business logic and security policies as the web interface through the unified domain service layer (`server/services/*`), ensuring consistency across browser interactions, command-line scripts, and external automations.

Key Characteristics:
- **100% Offline-First**: Fully self-contained without external API dependencies or cloud accounts.
- **Dual Authentication**: Accepts either HttpOnly browser session cookies or Bearer API keys (`rap_live_<24-hex-bytes>`).
- **Strict Role-Based Access Control**: All requests evaluate event-scoped roles (`ADMIN`, `ORGANIZER`, `JUDGE`, `PARTICIPANT`).
- **Standardized Response Envelope**: All successful responses return `{ "data": ... }`, with optional `{ "meta": { "page", "limit", "total", ... } }`.
- **Sanitized Errors**: Error responses follow RFC-7807/standard format `{ "error": { "code": "...", "message": "...", "details": ... } }` and never leak internal stack traces or database errors.

---

## 2. Authentication & Authorization

### 2.1 API Keys
Users can generate programmatic API keys via `/api/v1/auth/keys` or the Web UI.
- **Format**: `rap_live_<48 hex chars>`
- **Storage**: Plaintext keys are presented **once** at creation. The server hashes keys using SHA-256 (`crypto.createHash('sha256')`) and stores only the digest.
- **Usage**: Include the key in the HTTP `Authorization` header:
  ```http
  Authorization: Bearer rap_live_a1b2c3d4e5f6...
  ```

### 2.2 Browser Session Authentication
Web applications and client-side scripts running within the same origin automatically authenticate using the standard HttpOnly `raptoros_session` cookie.

### 2.3 Roles & Scope
| Role | Capabilities |
| :--- | :--- |
| `ADMIN` / `ORGANIZER` | Full read/write management of events, tracks, rubrics, assignments, normalization, voting config, webhooks, certificates, and data export/import. |
| `JUDGE` | Access assigned submissions, retrieve rubric criteria, submit score drafts, and finalize evaluations. Cannot access unassigned submissions or other judges' scores. |
| `PARTICIPANT` | View event details, manage their own team, create/update submissions prior to deadline, vote during community voting periods, and view their own certificates. |
| `PUBLIC` (Unauthenticated) | View published public gallery, check event public details, verify certificates, and query OpenAPI specifications. |

---

## 3. Endpoints Reference

### 3.1 Authentication & Profile
- `GET /api/v1/auth/me`: Returns identity, active session, and event memberships of the authenticated user.
- `GET /api/v1/auth/keys`: Lists all active API keys for the calling user (masked prefix/suffix).
- `POST /api/v1/auth/keys`: Generates a new API key. Returns `{ "apiKey": ..., "secretKey": "rap_live_..." }`.
- `DELETE /api/v1/auth/keys/{keyId}`: Revokes an active API key immediately.

### 3.2 Events & Tracks
- `GET /api/v1/events`: Lists events with pagination (`?page=1&limit=20&status=...`).
- `GET /api/v1/events/{eventId}`: Retrieves detailed information for a specific event (by ID or slug).
- `GET /api/v1/events/{eventId}/tracks`: Retrieves competition tracks for the event.

### 3.3 Teams & Submissions
- `GET /api/v1/events/{eventId}/teams`: Lists teams in the event with member counts and track information.
- `GET /api/v1/events/{eventId}/teams/{teamId}`: Retrieves a single team with members.
- `GET /api/v1/events/{eventId}/submissions`: Retrieves submissions (filtered by status/track).
- `GET /api/v1/events/{eventId}/submissions/{submissionId}`: Retrieves a submission. Includes repository, demo, and version metadata.
- `GET /api/v1/events/{eventId}/gallery`: Retrieves approved public gallery projects with deterministic pseudo-random shuffling and track filtering.

### 3.4 Judging & Scoring
- `GET /api/v1/events/{eventId}/judging/rubrics`: Lists active rubrics and criteria (`weight`, `maxScore`, `order`). Requires `JUDGE`, `ORGANIZER`, or `ADMIN`.
- `GET /api/v1/events/{eventId}/judging/assignments`: Lists judging assignments. Non-organizers receive only their own assignments with judge identities masked.
- `GET /api/v1/events/{eventId}/judging/scores`: Retrieves scores. Requires `JUDGE` (own scores only) or `ORGANIZER` (all scores).
- `POST /api/v1/events/{eventId}/judging/scores`: Submits score draft or final score for an assignment.

### 3.5 Signed Judge Records
- `GET /api/v1/events/{eventId}/judging/records`: Returns cryptographically signed judge records for finalized evaluations. Judge identities are pseudonymized (`Judge #A1B2`).
- `POST /api/v1/events/{eventId}/judging/records/verify`: Publicly verifies an Ed25519 signature of an evaluation payload against the server's public key.
- `GET /api/v1/public-key`: Returns the server's Ed25519 public verification key in SPKI PEM format.

### 3.6 Results & Normalization
- `GET /api/v1/events/{eventId}/results`: Retrieves published rankings, normalized scores, and prize allocations. Returns 403/404 if results have not yet been published by organizers.

### 3.7 Community Voting & Comments
- `GET /api/v1/events/{eventId}/voting/config`: Retrieves public voting window status (`OPEN`, `CLOSED`, `SCHEDULED`).
- `POST /api/v1/events/{eventId}/submissions/{submissionId}/vote`: Casts a community vote. Enforces anti-abuse, self-voting constraints, and rate limits.
- `DELETE /api/v1/events/{eventId}/submissions/{submissionId}/vote`: Retracts a previously cast vote during an open voting window.
- `GET /api/v1/events/{eventId}/voting/results`: Retrieves community vote tally. Only accessible if organizers have published community results.
- `GET /api/v1/events/{eventId}/submissions/{submissionId}/comments`: Retrieves approved comments with pagination.
- `POST /api/v1/events/{eventId}/submissions/{submissionId}/comments`: Submits a comment. Content is validated against length limits, profanity, and abuse detection.

### 3.8 Certificates & Verification
- `GET /api/v1/events/{eventId}/certificates`: Lists issued certificates for the event. Requires `ORGANIZER` or `ADMIN`.
- `POST /api/v1/events/{eventId}/certificates`: Issues a certificate (`PARTICIPATION`, `WINNER`, `JUDGE`, `ORGANIZER`) after server-side eligibility check.
- `DELETE /api/v1/events/{eventId}/certificates/{certificateId}/revoke`: Revokes a certificate with reason.
- `GET /api/v1/certificates/verify/{verificationCode}`: Public verification endpoint. Returns `{ "status": "VALID" | "REVOKED" | "NOT_FOUND", ... }` without exposing recipient emails. Rate-limited to 30 requests/min.

### 3.9 Webhooks
- `GET /api/v1/events/{eventId}/webhooks`: Lists webhook subscriptions for the event.
- `POST /api/v1/events/{eventId}/webhooks`: Creates a webhook subscription with HMAC-SHA256 secret.
- `GET /api/v1/events/{eventId}/webhooks/{webhookId}`: Retrieves webhook details.
- `PATCH /api/v1/events/{eventId}/webhooks/{webhookId}`: Updates webhook URL, active state, or event filters.
- `DELETE /api/v1/events/{eventId}/webhooks/{webhookId}`: Deletes a webhook subscription.
- `GET /api/v1/events/{eventId}/webhooks/{webhookId}/deliveries`: Lists recent deliveries and HTTP status codes.

### 3.10 Bulk Import & Export
- `GET /api/v1/events/{eventId}/export/{resource}`: Downloads deterministic CSV export (`participants`, `teams`, `submissions`, `scores`, `results`).
- `POST /api/v1/events/{eventId}/import/{resource}`: Uploads CSV data for bulk creation (`participants`, `teams`, `submissions`). Returns row-by-row validation results.

### 3.11 OpenAPI Specification
- `GET /api/v1/openapi.json` & `GET /docs/openapi.json`: Returns the complete OpenAPI 3.0.3 specification.
