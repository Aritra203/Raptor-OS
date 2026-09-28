import { prisma } from "@/lib/db/prisma";
import type { Certificate, CertificateType, Prisma } from "@prisma/client";

export interface FindCertificatesOptions {
  skip?: number;
  take?: number;
  type?: CertificateType;
  isRevoked?: boolean;
}

export class CertificateRepository {
  async findById(id: string): Promise<
    | (Certificate & {
        recipient: { id: string; name: string; email: string };
        event: { id: string; name: string; slug: string };
      })
    | null
  > {
    return prisma.certificate.findUnique({
      where: { id },
      include: {
        recipient: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findByVerificationId(verificationId: string): Promise<
    | (Certificate & {
        recipient: { id: string; name: string };
        event: { id: string; name: string; slug: string };
      })
    | null
  > {
    return prisma.certificate.findUnique({
      where: { verificationId },
      include: {
        recipient: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findByEventAndRecipient(
    eventId: string,
    recipientId: string,
    type: CertificateType
  ): Promise<Certificate | null> {
    return prisma.certificate.findFirst({
      where: {
        eventId,
        recipientId,
        type,
        isRevoked: false,
      },
    });
  }

  async findManyByEvent(
    eventId: string,
    options: FindCertificatesOptions = {}
  ): Promise<
    Array<
      Certificate & {
        recipient: { id: string; name: string; email: string };
      }
    >
  > {
    const where: Prisma.CertificateWhereInput = {
      eventId,
      ...(options.type ? { type: options.type } : {}),
      ...(options.isRevoked !== undefined ? { isRevoked: options.isRevoked } : {}),
    };

    return prisma.certificate.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { issuedAt: "desc" },
      include: {
        recipient: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async countByEvent(
    eventId: string,
    options: Omit<FindCertificatesOptions, "skip" | "take"> = {}
  ): Promise<number> {
    const where: Prisma.CertificateWhereInput = {
      eventId,
      ...(options.type ? { type: options.type } : {}),
      ...(options.isRevoked !== undefined ? { isRevoked: options.isRevoked } : {}),
    };

    return prisma.certificate.count({ where });
  }

  async create(data: {
    eventId: string;
    recipientId: string;
    type: CertificateType;
    title: string;
    description?: string | null;
    verificationId: string;
    resultId?: string | null;
    prizeId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<
    Certificate & {
      recipient: { id: string; name: string; email: string };
    }
  > {
    return prisma.certificate.create({
      data: {
        eventId: data.eventId,
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        description: data.description,
        verificationId: data.verificationId,
        resultId: data.resultId,
        prizeId: data.prizeId,
        metadata: data.metadata,
      },
      include: {
        recipient: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async revoke(id: string, reason: string): Promise<Certificate> {
    return prisma.certificate.update({
      where: { id },
      data: {
        isRevoked: true,
        revocationReason: reason,
      },
    });
  }
}

export const certificateRepository = new CertificateRepository();
