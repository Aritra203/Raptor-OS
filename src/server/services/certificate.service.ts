import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { certificateRepository } from "@/server/repositories/certificate.repository";
import { auditService } from "@/server/services/audit.service";
import { InMemoryRateLimiter } from "@/server/auth/rate-limiter";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
} from "@/lib/errors/app-error";
import type { CertificateType, Prisma } from "@prisma/client";
import type {
  CertificateDTO,
  PublicCertificateVerificationDTO,
} from "@/server/dto/api-v1.dto";
import { toCertificateDTO } from "@/server/dto/api-v1.dto";

// Rate limiter for public verification endpoint: 30 requests per minute
const verificationRateLimiter = new InMemoryRateLimiter();

export class CertificateService {
  /**
   * Generates a non-sequential, cryptographically random, unguessable verification code.
   * Format: RAPTOR-CERT-<YEAR>-<TYPE>-<RANDOM12HEX>
   */
  generateVerificationCode(type: CertificateType): string {
    const year = new Date().getFullYear();
    const entropy = crypto.randomBytes(6).toString("hex").toLowerCase();
    return `RAPTOR-CERT-${year}-${type}-${entropy}`;
  }

  /**
   * Evaluates server-side certificate eligibility for a recipient.
   */
  async checkEligibility(
    eventId: string,
    recipientId: string,
    type: CertificateType
  ): Promise<{ eligible: boolean; reason?: string }> {
    const membership = await prisma.eventMembership.findFirst({
      where: { eventId, userId: recipientId, status: "ACTIVE" },
    });

    if (!membership) {
      return { eligible: false, reason: "User is not an active member of this event." };
    }

    switch (type) {
      case "PARTICIPATION": {
        if (membership.role !== "PARTICIPANT") {
          return { eligible: false, reason: "Participation certificates are reserved for participants." };
        }
        // Must be in a team for this event
        const teamMember = await prisma.teamMember.findFirst({
          where: { userId: recipientId, team: { eventId } },
        });
        if (!teamMember) {
          return { eligible: false, reason: "Participant must belong to a team in this event." };
        }
        return { eligible: true };
      }

      case "WINNER": {
        // Find if recipient's team has a prize or top 3 rank in published results
        const teamMember = await prisma.teamMember.findFirst({
          where: { userId: recipientId, team: { eventId } },
          include: {
            team: {
              include: {
                submission: {
                  include: {
                    projectResults: {
                      where: {
                        snapshot: { eventId, status: "PUBLISHED" },
                      },
                    },
                    result: {
                      where: { eventId, isPublished: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!teamMember?.team.submission) {
          return { eligible: false, reason: "Recipient does not belong to a team with a submitted project." };
        }

        const sub = teamMember.team.submission;
        const projectResult = sub.projectResults[0];
        const legacyResult = sub.result;

        const isWinner =
          (projectResult && (projectResult.rank <= 3 || projectResult.prizeId !== null)) ||
          (legacyResult && ((legacyResult.rank !== null && legacyResult.rank <= 3) || legacyResult.prizeId !== null));

        if (!isWinner) {
          return { eligible: false, reason: "Recipient's project is not recorded as an official top 3 winner or prize recipient." };
        }
        return { eligible: true };
      }

      case "JUDGE": {
        if (membership.role !== "JUDGE") {
          return { eligible: false, reason: "User is not assigned as a judge for this event." };
        }
        // Verify judge evaluated at least one assignment
        const scoreCount = await prisma.score.count({
          where: { eventId, judgeId: recipientId, isFinal: true },
        });
        if (scoreCount === 0) {
          return { eligible: false, reason: "Judge has not finalized any evaluations in this event." };
        }
        return { eligible: true };
      }

      case "ORGANIZER": {
        if (membership.role !== "ORGANIZER" && membership.role !== "ADMIN") {
          return { eligible: false, reason: "User is not an organizer or administrator for this event." };
        }
        return { eligible: true };
      }

      default:
        return { eligible: true };
    }
  }

  /**
   * Issues a certificate after verifying eligibility and uniqueness.
   */
  async issueCertificate(
    eventId: string,
    issuerId: string,
    input: {
      recipientId: string;
      type: CertificateType;
      title: string;
      description?: string | null;
      resultId?: string | null;
      prizeId?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  ): Promise<CertificateDTO> {
    // 1. Check eligibility
    const eligibility = await this.checkEligibility(eventId, input.recipientId, input.type);
    if (!eligibility.eligible) {
      throw new ValidationError(
        eligibility.reason || `Recipient is not eligible for ${input.type} certificate.`
      );
    }

    // 2. Prevent duplicate active certificate of same type
    const existing = await certificateRepository.findByEventAndRecipient(
      eventId,
      input.recipientId,
      input.type
    );
    if (existing) {
      throw new ConflictError(
        `An active ${input.type} certificate already exists for this recipient in this event.`
      );
    }

    // 3. Generate cryptographic verification code
    const verificationId = this.generateVerificationCode(input.type);

    // 4. Create record
    const certificate = await certificateRepository.create({
      eventId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      description: input.description,
      verificationId,
      resultId: input.resultId,
      prizeId: input.prizeId,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
    });

    // 5. Audit log
    await auditService.logAction({
      eventId,
      actorId: issuerId,
      action: "CERTIFICATE_ISSUED",
      entityType: "Certificate",
      entityId: certificate.id,
      metadata: {
        recipientId: input.recipientId,
        type: input.type,
        verificationId,
      },
    });

    return toCertificateDTO(certificate);
  }

  /**
   * Revokes an existing certificate with reason.
   */
  async revokeCertificate(
    eventId: string,
    certificateId: string,
    revokerId: string,
    reason: string
  ): Promise<CertificateDTO> {
    const cert = await certificateRepository.findById(certificateId);
    if (!cert || cert.eventId !== eventId) {
      throw new NotFoundError("Certificate", certificateId);
    }

    if (cert.isRevoked) {
      throw new ConflictError("This certificate is already revoked.");
    }

    const updated = await certificateRepository.revoke(certificateId, reason);

    await auditService.logAction({
      eventId,
      actorId: revokerId,
      action: "CERTIFICATE_REVOKED",
      entityType: "Certificate",
      entityId: certificateId,
      metadata: { reason },
    });

    return toCertificateDTO(updated);
  }

  /**
   * Public rate-limited certificate verification endpoint.
   * Returns VALID, REVOKED, or NOT_FOUND without leaking sensitive private data.
   */
  async verifyCertificate(
    verificationCode: string,
    clientIp = "anonymous"
  ): Promise<PublicCertificateVerificationDTO> {
    // 1. Rate limiting check (30 requests / 60s per client IP)
    const rateCheck = verificationRateLimiter.check(`verify:${clientIp}`, 30, 60000);
    if (!rateCheck.allowed) {
      throw new TooManyRequestsError(
        "Verification rate limit exceeded. Please try again later.",
        rateCheck.retryAfterSeconds
      );
    }
    verificationRateLimiter.hit(`verify:${clientIp}`, 60000);

    // 2. Query certificate
    const cert = await certificateRepository.findByVerificationId(verificationCode);
    if (!cert) {
      return { status: "NOT_FOUND" };
    }

    if (cert.isRevoked) {
      return {
        status: "REVOKED",
        certificate: {
          verificationId: cert.verificationId,
          recipientName: cert.recipient.name,
          eventName: cert.event.name,
          type: cert.type,
          title: cert.title,
          description: cert.description,
          issuedAt: cert.issuedAt.toISOString(),
          isRevoked: true,
          revocationReason: cert.revocationReason,
        },
      };
    }

    return {
      status: "VALID",
      certificate: {
        verificationId: cert.verificationId,
        recipientName: cert.recipient.name,
        eventName: cert.event.name,
        type: cert.type,
        title: cert.title,
        description: cert.description,
        issuedAt: cert.issuedAt.toISOString(),
        isRevoked: false,
      },
    };
  }
}

export const certificateService = new CertificateService();
