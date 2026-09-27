# RaptorOS Webhooks Subsystem

## 1. Overview

RaptorOS provides an event-driven webhook notification subsystem designed specifically for offline, local, or on-premises hackathons. Webhooks allow external integrations (such as local Discord bots, physical LED display boards, badge printing stations, or spreadsheet synchronizers) to react to platform events in near real time.

Key Principles:
- **Offline Resilient**: Deliveries to unreachable or slow endpoints fail gracefully without delaying the main user transaction or crashing background tasks.
- **Cryptographically Signed**: Every HTTP POST delivery includes an HMAC-SHA256 signature in the `X-RaptorOS-Signature` header.
- **Replay Protection**: Each delivery includes a unique UUID in `X-RaptorOS-Delivery` and an ISO-8601 timestamp in `X-RaptorOS-Timestamp`.
- **Bounded Retries**: Deliveries have bounded timeouts (5000ms) with failure reasons recorded for auditing.

---

## 2. Webhook Security & Verification

### 2.1 Headers Sent with Each Delivery
Each HTTP POST request sent by RaptorOS contains the following headers:

| Header | Description |
| :--- | :--- |
| `Content-Type` | `application/json` |
| `User-Agent` | `RaptorOS-Webhook-Delivery/1.0` |
| `X-RaptorOS-Delivery` | Unique UUID for the delivery attempt (e.g., `del_a1b2c3d4...`) |
| `X-RaptorOS-Event` | Event type name (e.g., `submission.created`) |
| `X-RaptorOS-Timestamp` | ISO-8601 UTC timestamp of dispatch |
| `X-RaptorOS-Signature` | HMAC-SHA256 digest formatted as `sha256=<hex_digest>` |

### 2.2 Verifying Signatures in Your Receiver

To ensure payloads originate from your RaptorOS instance and have not been tampered with:

#### Node.js / TypeScript Example
```typescript
import crypto from "crypto";

export function verifyRaptorOSWebhook(
  rawPayload: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7);
  const hmac = crypto.createHmac("sha256", webhookSecret);
  const computed = hmac.update(rawPayload, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  if (expectedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
}
```

#### Python Example
```python
import hmac
import hashlib

def verify_raptoros_webhook(raw_payload: bytes, signature_header: str, secret: str) -> bool:
    if not signature_header.startswith("sha256="):
        return False
    
    expected_hex = signature_header[7:]
    computed_hex = hmac.new(
        secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_hex, computed_hex)
```

---

## 3. Supported Event Types

| Event Type | Trigger | Payload Contents |
| :--- | :--- | :--- |
| `submission.created` | Team creates draft submission | `{ "submissionId", "teamId", "title", "createdAt" }` |
| `submission.submitted` | Team locks/submits final project | `{ "submissionId", "teamId", "title", "trackId", "submittedAt" }` |
| `judging.score_submitted` | Judge finalizes score | `{ "assignmentId", "submissionId", "isFinal", "completedAt" }` |
| `results.published` | Organizers publish rankings | `{ "eventId", "snapshotId", "publishedAt" }` |
| `vote.cast` | Community vote recorded | `{ "submissionId", "voteId" }` |
| `certificate.issued` | Verifiable certificate issued | `{ "certificateId", "verificationId", "recipientName", "type" }` |

---

## 4. Delivery Lifecycle & Auditing

1. When a platform domain event occurs (e.g. `communityService.castVote` or `certificateService.issueCertificate`), `webhookService.dispatchWebhookEvent(...)` is triggered.
2. The service queries all active `Webhook` records for that `eventId` that have subscribed to the specific event.
3. A `WebhookDelivery` database record is immediately initialized in `PENDING` state.
4. An HTTP POST request is asynchronously dispatched with a strict 5-second abort controller.
5. If the receiver responds with HTTP 2xx, the record is marked `SUCCESS` with `deliveredAt` and `statusCode`.
6. If the receiver times out, is unreachable (connection refused), or returns HTTP 4xx/5xx, the record is marked `FAILED` with the `failureReason` and status code.

Organizers can review all delivery logs, HTTP responses, and payloads via:
```http
GET /api/v1/events/{eventId}/webhooks/{webhookId}/deliveries
```

---

## 5. SSRF (Server-Side Request Forgery) Protection

To prevent malicious users or compromised organizer accounts from using RaptorOS as an arbitrary internal-network HTTP client, all webhook URLs are strictly validated:

1. **Protocol Restrictions**: Only `http:` and `https:` schemes are permitted. Schemes such as `file:`, `gopher:`, or `ftp:` are rejected.
2. **Cloud Metadata Defense**: Destinations pointing to cloud metadata endpoints (e.g. `169.254.169.254`, `metadata.google.internal`) are **unconditionally blocked**.
3. **Private Subnets & Loopbacks**: Destinations targeting loopback addresses (`127.0.0.1`, `localhost`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), or container hostnames (`postgres`, `db`) are prohibited by default.
4. **Prohibited Ports**: High-risk ports (SSH 22, SMTP 25, Postgres 5432, Redis 6379, Docker 2375/2376) are rejected.
5. **Self-Hosted Development Exception**: For local offline testing or isolated LAN deployments where webhook receivers run on private subnets, operators can set `RAPTOR_ALLOW_LOCAL_WEBHOOKS=true` in `.env`. Cloud metadata endpoints remain blocked even with this flag enabled.
