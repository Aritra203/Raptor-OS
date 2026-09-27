# RaptorOS Security Architecture (Phase 3)

## 1. Threat Model & Offline-First Security Posture

RaptorOS is engineered to run in offline venue environments, local networks, or private servers. As an offline-first system:
- **Zero Cloud Dependence**: The platform never relies on external authentication providers (Auth0, Firebase, Clerk, Cognito).
- **Network Boundaries**: It is designed to withstand hostile local network conditions (e.g. hackathon participants running vulnerability scanners on the local LAN).
- **Defense in Depth**: Password storage, session management, and authorization checks are layered such that no single failure compromises the system.

---

## 2. Password Hashing (Memory-Hard Scrypt)

### Specification
- **Algorithm**: `scrypt` (via Node.js built-in `crypto.scrypt`)
- **Cost Parameters (OWASP Recommended)**:
  - $N = 16384$ (CPU/memory cost parameter)
  - $r = 8$ (Block size parameter)
  - $p = 1$ (Parallelization parameter)
  - Output Key Length: 64 bytes (512 bits)
  - Salt Length: 16 cryptographically secure random bytes generated via `crypto.randomBytes(16)`
- **Serialized Format**:
  `$scrypt$N=16384,r=8,p=1$<saltHex>$<derivedKeyHex>`

### Resistance to Side-Channel Attacks
- Verification derives the candidate hash with matching parameters and compares the result using `crypto.timingSafeEqual`.
- This ensures constant execution time, preventing timing-based password recovery.
- Plaintext passwords and derived hashes are never exposed in log outputs or API responses.

---

## 3. Session Token Architecture & Cryptographic Hashing

### Vulnerability Addressed
If a raw session token is stored in the database, any read-only SQL injection or database dump instantly compromises all active sessions.

### Protection Mechanism
1. **Token Generation**: 32 cryptographically random bytes generated via `crypto.randomBytes(32)` (64-character hexadecimal string).
2. **Database Persistence**: The database **never** stores the raw token. Instead, it stores `tokenHash`:
   $$\text{tokenHash} = \text{SHA-256}(\text{rawToken})$$
   The `tokenHash` column is marked unique and indexed in PostgreSQL.
3. **Cookie Transport**: The raw token is stored only in the user's browser cookie:
   - `HttpOnly: true` (prevents XSS access from JavaScript)
   - `SameSite: "lax"` (mitigates CSRF on cross-site requests)
   - `Secure: true` in production environments
   - `Path: "/"`
   - Expiration: 7 days sliding window
4. **Validation**: When an incoming request arrives, the server hashes the cookie value with SHA-256 and queries PostgreSQL for `tokenHash`.

---

## 4. Event-Scoped Authorization (RBAC)

### No Global User Role
In RaptorOS, a user **does not have a global role**. A user is an identity that can participate in multiple events with different privileges:
- Alice may be an `ORGANIZER` in Hackathon 2026.
- Alice may be a `JUDGE` in Hackathon Winter.
- Alice may be a `PARTICIPANT` in Hackathon Summer.

### Enforcement Layer
Authorization helpers in `server/auth/authorization.ts`:
- `requireUser()`: Verifies that a valid, unrevoked session exists.
- `requireEventMember(eventId)`: Verifies that the user has joined the specified event.
- `requireEventRole(eventId, roles)`: Verifies that the user holds at least one of the specified roles (`ADMIN`, `ORGANIZER`, `JUDGE`, `PARTICIPANT`) within that specific event.

Attempts to perform an action on an event without the requisite role fail immediately with `ForbiddenError` (HTTP 403).

---

## 5. Timing Attack & Enumeration Mitigations

- **Identical Failure Messages**: Login attempts return `"Invalid email or password."` regardless of whether the email exists or the password was incorrect.
- **Constant-Time Fallback**: Even when an email is not found, a dummy scrypt verification is executed to equalize response latency, preventing timing-based user enumeration.
- **In-Memory Rate Limiting**:
  - Login attempts: Capped at 5 failed attempts per IP / email per 15-minute window.
  - Registration attempts: Capped at 10 attempts per IP per hour.
  - Exceeding thresholds throws `TooManyRequestsError` (HTTP 429).

---

## 6. Audit Logging & Credential Redaction

- All security-relevant actions (`AUTH_REGISTER`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`) are recorded in the `AuditLog` table.
- Audit log metadata never contains passwords, session tokens, or password hashes.
- The structured logger automatically scrubs values associated with keys such as `password`, `token`, `secret`, and `authorization`.
