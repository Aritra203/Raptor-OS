import type {
  Event,
  Track,
  Team,
  Submission,
  Certificate,
  Webhook,
  WebhookDelivery,
  SignedJudgeRecord,
  ApiKey,
  User,
} from "@prisma/client";

// ==============================================================================
// AUTH & USERS
// ==============================================================================

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export function toUserDTO(user: Partial<User>): UserDTO {
  return {
    id: user.id || "",
    email: user.email || "",
    name: user.name || "",
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || null,
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
  };
}

// ==============================================================================
// EVENTS & TRACKS
// ==============================================================================

export interface EventDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  state: string;
  location: string | null;
  isVirtual: boolean;
  timezone: string;
  registrationStart: string | null;
  registrationEnd: string | null;
  submissionsStart: string | null;
  submissionsEnd: string | null;
  judgingStart: string | null;
  judgingEnd: string | null;
  startsAt: string | null;
  endsAt: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  createdAt: string;
}

export function toEventDTO(event: Event): EventDTO {
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    description: event.description,
    state: event.state,
    location: event.location,
    isVirtual: event.isVirtual,
    timezone: event.timezone,
    registrationStart: event.registrationStart?.toISOString() || null,
    registrationEnd: event.registrationEnd?.toISOString() || null,
    submissionsStart: event.submissionsStart?.toISOString() || null,
    submissionsEnd: event.submissionsEnd?.toISOString() || null,
    judgingStart: event.judgingStart?.toISOString() || null,
    judgingEnd: event.judgingEnd?.toISOString() || null,
    startsAt: event.startsAt?.toISOString() || null,
    endsAt: event.endsAt?.toISOString() || null,
    minTeamSize: event.minTeamSize,
    maxTeamSize: event.maxTeamSize,
    createdAt: event.createdAt.toISOString(),
  };
}

export interface TrackDTO {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
}

export function toTrackDTO(track: Track): TrackDTO {
  return {
    id: track.id,
    eventId: track.eventId,
    name: track.name,
    slug: track.slug,
    description: track.description,
    order: track.order,
  };
}

// ==============================================================================
// TEAMS & MEMBERS
// ==============================================================================

export interface TeamDTO {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  description: string | null;
  trackId: string | null;
  memberCount?: number;
  members?: Array<{
    userId: string;
    name: string;
    role: string;
  }>;
  createdAt: string;
}

export function toTeamDTO(
  team: Team & {
    members?: Array<{ role: string; user: { id: string; name: string } }>;
    _count?: { members: number };
  }
): TeamDTO {
  return {
    id: team.id,
    eventId: team.eventId,
    name: team.name,
    slug: team.slug,
    description: team.description,
    trackId: team.trackId,
    memberCount: team._count?.members ?? team.members?.length,
    members: team.members?.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      role: m.role,
    })),
    createdAt: team.createdAt.toISOString(),
  };
}

// ==============================================================================
// SUBMISSIONS
// ==============================================================================

export interface SubmissionDTO {
  id: string;
  eventId: string;
  teamId: string;
  teamName?: string;
  trackId: string | null;
  trackName?: string | null;
  title: string;
  description: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  deploymentUrl: string | null;
  state: string;
  submittedAt: string | null;
  communityVoteCount?: number;
  createdAt: string;
}

export function toSubmissionDTO(
  submission: Submission & {
    team?: { name: string };
    track?: { name: string } | null;
    _count?: { votes: number };
  },
  includeVoteCount = false
): SubmissionDTO {
  return {
    id: submission.id,
    eventId: submission.eventId,
    teamId: submission.teamId,
    teamName: submission.team?.name,
    trackId: submission.trackId,
    trackName: submission.track?.name || null,
    title: submission.title,
    description: submission.description,
    repositoryUrl: submission.repositoryUrl,
    demoUrl: submission.demoUrl,
    deploymentUrl: submission.deploymentUrl,
    state: submission.state,
    submittedAt: submission.submittedAt?.toISOString() || null,
    ...(includeVoteCount
      ? { communityVoteCount: submission._count?.votes || 0 }
      : {}),
    createdAt: submission.createdAt.toISOString(),
  };
}

// ==============================================================================
// CERTIFICATES
// ==============================================================================

export interface CertificateDTO {
  id: string;
  eventId: string;
  recipientId: string;
  recipientName?: string;
  type: string;
  title: string;
  description: string | null;
  verificationId: string;
  isRevoked: boolean;
  revocationReason: string | null;
  issuedAt: string;
}

export function toCertificateDTO(
  cert: Certificate & { recipient?: { name: string } }
): CertificateDTO {
  return {
    id: cert.id,
    eventId: cert.eventId,
    recipientId: cert.recipientId,
    recipientName: cert.recipient?.name,
    type: cert.type,
    title: cert.title,
    description: cert.description,
    verificationId: cert.verificationId,
    isRevoked: cert.isRevoked,
    revocationReason: cert.revocationReason,
    issuedAt: cert.issuedAt.toISOString(),
  };
}

export interface PublicCertificateVerificationDTO {
  status: "VALID" | "REVOKED" | "NOT_FOUND";
  certificate?: {
    verificationId: string;
    recipientName: string;
    eventName: string;
    type: string;
    title: string;
    description: string | null;
    issuedAt: string;
    isRevoked: boolean;
    revocationReason?: string | null;
  };
}

// ==============================================================================
// WEBHOOKS
// ==============================================================================

export interface WebhookDTO {
  id: string;
  eventId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretMasked: string;
  createdAt: string;
}

export function toWebhookDTO(webhook: Webhook): WebhookDTO {
  return {
    id: webhook.id,
    eventId: webhook.eventId,
    name: webhook.name,
    url: webhook.url,
    events: Array.isArray(webhook.events) ? (webhook.events as string[]) : [],
    isActive: webhook.isActive,
    secretMasked: `${webhook.secret.slice(0, 4)}...${webhook.secret.slice(-4)}`,
    createdAt: webhook.createdAt.toISOString(),
  };
}

export interface WebhookDeliveryDTO {
  id: string;
  webhookId: string;
  eventType: string;
  deliveryId: string;
  status: string;
  attemptCount: number;
  statusCode: number | null;
  failureReason: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export function toWebhookDeliveryDTO(
  delivery: WebhookDelivery
): WebhookDeliveryDTO {
  return {
    id: delivery.id,
    webhookId: delivery.webhookId,
    eventType: delivery.eventType,
    deliveryId: delivery.deliveryId,
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    statusCode: delivery.statusCode,
    failureReason: delivery.failureReason,
    deliveredAt: delivery.deliveredAt?.toISOString() || null,
    createdAt: delivery.createdAt.toISOString(),
  };
}

// ==============================================================================
// SIGNED JUDGE RECORDS
// ==============================================================================

export interface SignedJudgeRecordDTO {
  id: string;
  eventId: string;
  submissionId: string;
  snapshotId: string | null;
  judgePseudonym: string;
  recordHash: string;
  signature: string;
  algorithm: string;
  createdAt: string;
}

export function toSignedJudgeRecordDTO(
  record: SignedJudgeRecord
): SignedJudgeRecordDTO {
  return {
    id: record.id,
    eventId: record.eventId,
    submissionId: record.submissionId,
    snapshotId: record.snapshotId,
    judgePseudonym: record.judgePseudonym,
    recordHash: record.recordHash,
    signature: record.signature,
    algorithm: record.algorithm,
    createdAt: record.createdAt.toISOString(),
  };
}

// ==============================================================================
// API KEYS
// ==============================================================================

export interface ApiKeyDTO {
  id: string;
  name: string;
  keyPrefix: string;
  eventId: string | null;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

export function toApiKeyDTO(apiKey: ApiKey): ApiKeyDTO {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    eventId: apiKey.eventId,
    scopes: Array.isArray(apiKey.scopes) ? (apiKey.scopes as string[]) : [],
    lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
    expiresAt: apiKey.expiresAt?.toISOString() || null,
    isRevoked: apiKey.isRevoked,
    createdAt: apiKey.createdAt.toISOString(),
  };
}
