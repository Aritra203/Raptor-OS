import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import {
  signCanonicalData,
  verifyCanonicalData,
  getPublicVerificationKey,
  computeSha256,
} from "@/lib/crypto/signing";
import { auditService } from "@/server/services/audit.service";
import { NotFoundError } from "@/lib/errors/app-error";
import type { SignedJudgeRecordDTO } from "@/server/dto/api-v1.dto";
import { toSignedJudgeRecordDTO } from "@/server/dto/api-v1.dto";

export class SignedRecordsService {
  /**
   * Generates a deterministic, irreversible pseudonymous identifier for a judge in an event.
   * Format: Judge-<8-hex-chars>
   */
  generateJudgePseudonym(judgeId: string, eventId: string): string {
    const hash = crypto
      .createHmac("sha256", eventId)
      .update(judgeId)
      .digest("hex");
    return `Judge-${hash.slice(0, 8).toUpperCase()}`;
  }

  /**
   * Cryptographically signs published evaluation data for a submission using the server's Ed25519 key.
   */
  async signSubmissionEvaluation(
    eventId: string,
    submissionId: string,
    snapshotId?: string | null
  ): Promise<SignedJudgeRecordDTO> {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        scores: {
          where: { isFinal: true },
          include: {
            items: {
              include: { criterion: true },
            },
          },
        },
      },
    });

    if (!submission || submission.eventId !== eventId) {
      throw new NotFoundError("Submission", submissionId);
    }

    const projectResult = await prisma.projectResult.findFirst({
      where: {
        submissionId,
        ...(snapshotId ? { snapshotId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const finalScore = projectResult ? projectResult.finalScore.toString() : "0.0000";
    const rawAggregateScore = projectResult
      ? projectResult.rawAggregateScore.toString()
      : "0.0000";

    // Build pseudonymized evaluation items (never leaking private judge identities)
    const pseudonymizedEvaluations = submission.scores.map((s) => {
      const totalRaw = s.items.reduce((acc, item) => acc + Number(item.rawScore), 0);
      return {
        judgePseudonym: this.generateJudgePseudonym(s.judgeId, eventId),
        rawScore: totalRaw.toString(),
        itemCount: s.items.length,
      };
    });

    const canonicalPayload = {
      version: 1,
      eventId,
      submissionId,
      snapshotId: snapshotId || null,
      finalScore,
      rawAggregateScore,
      evaluations: pseudonymizedEvaluations,
      timestamp: new Date().toISOString(),
    };

    const { canonicalData, recordHash, signature, algorithm } =
      await signCanonicalData(canonicalPayload);

    const record = await prisma.signedJudgeRecord.create({
      data: {
        eventId,
        submissionId,
        snapshotId: snapshotId || null,
        judgePseudonym: pseudonymizedEvaluations[0]?.judgePseudonym || "Consensus",
        canonicalData: JSON.parse(canonicalData),
        recordHash,
        signature,
        algorithm,
      },
    });

    await auditService.logAction({
      eventId,
      action: "JUDGE_RECORD_SIGNED",
      entityType: "SignedJudgeRecord",
      entityId: record.id,
      metadata: { submissionId, recordHash },
    });

    return toSignedJudgeRecordDTO(record);
  }

  /**
   * Verifies the authenticity and tamper-resistance of a signed judging record.
   */
  async verifySignedRecord(
    recordHash: string,
    providedCanonicalData?: unknown,
    providedSignature?: string
  ): Promise<{
    isValid: boolean;
    recordHash: string;
    algorithm: string;
    signedAt: string;
    publicKeyPem: string;
  }> {
    const publicKeyPem = await getPublicVerificationKey();

    // 1. If explicit payload & signature are provided, verify directly
    if (providedCanonicalData && providedSignature) {
      const isValid = verifyCanonicalData(
        providedCanonicalData,
        providedSignature,
        publicKeyPem
      );
      const computedHash = computeSha256(providedCanonicalData as object);
      return {
        isValid,
        recordHash: computedHash,
        algorithm: "Ed25519",
        signedAt: new Date().toISOString(),
        publicKeyPem,
      };
    }

    // 2. Query stored record by hash or ID
    const record = await prisma.signedJudgeRecord.findFirst({
      where: {
        OR: [{ recordHash }, { id: recordHash }],
      },
    });

    if (!record) {
      throw new NotFoundError("Signed judge record", recordHash);
    }

    const isValid = verifyCanonicalData(
      record.canonicalData,
      record.signature,
      publicKeyPem
    );

    return {
      isValid,
      recordHash: record.recordHash,
      algorithm: record.algorithm,
      signedAt: record.createdAt.toISOString(),
      publicKeyPem,
    };
  }

  /**
   * Retrieves signed judge records for an event.
   */
  async getEventSignedRecords(
    eventId: string,
    options: { skip?: number; take?: number } = {}
  ): Promise<SignedJudgeRecordDTO[]> {
    const records = await prisma.signedJudgeRecord.findMany({
      where: { eventId },
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
    });

    return records.map(toSignedJudgeRecordDTO);
  }
}

export const signedRecordsService = new SignedRecordsService();
