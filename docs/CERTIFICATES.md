# RaptorOS Verifiable Certificates & Signed Records

## 1. Overview

RaptorOS implements a dual-layer verification system for hackathon participants, judges, and evaluation records:
1. **Verifiable Participant Records & Certificates**: Cryptographically unguessable verification IDs with public status resolution (`VALID`, `REVOKED`, `NOT_FOUND`).
2. **Signed Judge Evaluation Records**: Canonical JSON evaluations signed with the server's Ed25519 private key, verifiable against the public key without exposing judge identities.

Both subsystems are 100% self-contained and require zero third-party certificate authorities, cloud services, or external blockchain registries.

---

## 2. Certificate Architecture & Eligibility

### 2.1 Certificate Types
- `PARTICIPATION`: Issued to hackers who joined a team with a submitted (`SUBMITTED`) project.
- `WINNER`: Issued to members of teams that achieved a top-3 ranking or won an official prize/track.
- `JUDGE`: Issued to designated judges who evaluated and finalized scoring for at least one assignment.
- `ORGANIZER`: Issued to event organizers and platform administrators.

### 2.2 Server-Side Eligibility Enforcement
Certificates cannot be arbitrarily issued. The `CertificateService.checkEligibility(...)` method validates event-scoped roles and database invariants before permitting generation:
- Participants with only `DRAFT` submissions are rejected.
- Non-judge users attempting to receive judge certificates are rejected.
- Judges with zero completed scores are rejected.
- Multiple active certificates of the same type for the same user in an event are disallowed.

### 2.3 Cryptographic Verification Identifiers
Verification identifiers are generated with high entropy using Node.js native `crypto.randomBytes`:
```text
Format: RAPTOR-CERT-<YEAR>-<TYPE>-<RANDOM12HEX>
Example: RAPTOR-CERT-2026-PARTICIPATION-af1b406a6cee
```
- **Non-sequential**: Guessing other participants' codes is statistically infeasible ($16^{12} \approx 2.81 \times 10^{14}$ possibilities per year/type).
- **Rate-Limited**: Public verification is strictly rate-limited (30 requests/minute per client IP) to prevent brute force enumeration.

---

## 3. Public Verification Endpoint & UI

### 3.1 Verification Card UI
Anyone can verify the authenticity of a certificate by navigating to:
```text
/verify/certificate/:verificationCode
```
The page performs an offline API lookup and displays:
- **Status Badge**: `VERIFIED & AUTHENTIC` (Green), `REVOKED CERTIFICATE` (Red), or `RECORD NOT FOUND` (Amber).
- **Recipient Name & Event**: Name of recipient and event title.
- **Certificate Type & Issue Date**: Track/prize title and timestamp.
- **Privacy Protection**: Recipient emails, user IDs, and internal passwords are never returned or rendered.

### 3.2 Public API Verification
```http
GET /api/v1/certificates/verify/RAPTOR-CERT-2026-PARTICIPATION-af1b406a6cee
```
Response:
```json
{
  "data": {
    "status": "VALID",
    "certificate": {
      "verificationId": "RAPTOR-CERT-2026-PARTICIPATION-af1b406a6cee",
      "recipientName": "Elena Builder",
      "eventName": "Raptor Hack 2026",
      "type": "PARTICIPATION",
      "title": "Certificate of Participation",
      "description": "Awarded for participating in Raptor Hack 2026.",
      "issuedAt": "2026-09-18T19:00:00.000Z",
      "isRevoked": false
    }
  }
}
```

---

## 4. Signed Judge Records (Ed25519)

### 4.1 Threat Model & Objective
In competitive hackathons, participants or sponsors may question the integrity of final project rankings. Signed judge records prove:
1. Every score was finalized before results were computed.
2. Criterion weights and rubric scores have not been tampered with post-event.
3. The server signed the exact evaluation payload.
4. Judge identities remain anonymous (`Judge #A1B2` pseudonym) to protect judges from retaliatory pressure.

### 4.2 Canonical JSON & Ed25519 Signatures
To ensure deterministic hashing across different platforms and database engines:
1. Payload keys are recursively sorted alphabetically (`lib/crypto/signing.ts:canonicalizeJson`).
2. A SHA-256 digest is computed over the canonical string.
3. The digest is signed using the server's Ed25519 private key (`crypto.sign(null, digest, privateKey)`).
4. The keypair is persisted in `SystemSetting` (`crypto.ed25519.public_key` and `crypto.ed25519.private_key`) to survive restarts.

### 4.3 Verifying an Evaluation Record

1. Retrieve the server's public key:
   ```http
   GET /api/v1/public-key
   ```
2. Retrieve the signed records for an event:
   ```http
   GET /api/v1/events/{eventId}/judging/records
   ```
3. Verify the signature independently with standard tooling:
   ```typescript
   import crypto from "crypto";

   const isValid = crypto.verify(
     null,
     Buffer.from(recordHash, "utf8"),
     publicKeyPem,
     Buffer.from(signatureBase64, "base64")
   );
   console.log("Evaluation signature authentic:", isValid);
   ```
