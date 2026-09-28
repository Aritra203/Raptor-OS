import { z } from "zod";
import { CertificateType } from "@prisma/client";
import { isSafeWebhookUrl } from "@/lib/security/ssrf";

// ==============================================================================
// API KEYS
// ==============================================================================

export const createApiKeySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  eventId: z.string().cuid().optional().nullable(),
  scopes: z.array(z.string()).optional().default(["read", "write"]),
  expiresInDays: z.number().int().min(1).max(365).optional().default(90),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ==============================================================================
// WEBHOOKS
// ==============================================================================

export const WEBHOOK_SUPPORTED_EVENTS = [
  "submission.created",
  "submission.updated",
  "submission.locked",
  "judging.completed",
  "results.published",
  "certificate.issued",
  "vote.cast",
  "comment.created",
] as const;

export type WebhookSupportedEvent = (typeof WEBHOOK_SUPPORTED_EVENTS)[number];

export const createWebhookSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (val) => isSafeWebhookUrl(val),
      "Webhook URL violates security or SSRF protection policy (unsupported scheme, prohibited port, cloud metadata, or private network address)"
    ),
  secret: z
    .string()
    .min(16, "Webhook secret must be at least 16 characters for security")
    .max(128)
    .optional(),
  events: z
    .array(z.string())
    .min(1, "Must subscribe to at least one event")
    .refine(
      (events) =>
        events.every((e) =>
          WEBHOOK_SUPPORTED_EVENTS.includes(e as WebhookSupportedEvent)
        ),
      "One or more subscribed events are invalid"
    ),
  isActive: z.boolean().optional().default(true),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  url: z
    .string()
    .url()
    .refine(
      (val) => isSafeWebhookUrl(val),
      "Webhook URL violates security or SSRF protection policy (unsupported scheme, prohibited port, cloud metadata, or private network address)"
    )
    .optional(),
  events: z
    .array(z.string())
    .min(1)
    .refine(
      (events) =>
        events.every((e) =>
          WEBHOOK_SUPPORTED_EVENTS.includes(e as WebhookSupportedEvent)
        ),
      "One or more subscribed events are invalid"
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// ==============================================================================
// CERTIFICATES
// ==============================================================================

export const issueCertificateSchema = z.object({
  recipientId: z.string().cuid("Invalid recipient ID"),
  type: z.nativeEnum(CertificateType),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional().nullable(),
  resultId: z.string().cuid().optional().nullable(),
  prizeId: z.string().cuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;

export const revokeCertificateSchema = z.object({
  reason: z.string().min(3, "Revocation reason is required").max(500),
});

export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;

// ==============================================================================
// SIGNED JUDGE RECORDS
// ==============================================================================

export const verifySignedRecordSchema = z.object({
  canonicalData: z.unknown(),
  signature: z.string().min(1, "Signature is required"),
  publicKeyPem: z.string().optional(),
});

export type VerifySignedRecordInput = z.infer<typeof verifySignedRecordSchema>;

// ==============================================================================
// BULK IMPORT
// ==============================================================================

export const importParticipantRowSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  role: z.enum(["PARTICIPANT", "JUDGE", "ORGANIZER"]).optional().default("PARTICIPANT"),
});

export const importTeamRowSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(100),
  leaderEmail: z.string().email("Leader email is invalid"),
  trackSlug: z.string().optional(),
});

export const importSubmissionRowSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  title: z.string().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().min(5, "Description must be at least 5 characters").max(5000),
  repositoryUrl: z.string().url().optional().or(z.literal("")),
  demoUrl: z.string().url().optional().or(z.literal("")),
  trackSlug: z.string().optional(),
});
