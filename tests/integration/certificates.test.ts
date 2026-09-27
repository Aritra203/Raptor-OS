import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { certificateService } from "@/server/services/certificate.service";
import { NextRequest } from "next/server";
import { GET as verifyRoute } from "@/app/api/v1/certificates/verify/[verificationCode]/route";

describe("Certificate Lifecycle & Verification Integration Tests (Phase 9)", () => {
  const eventId = "evt_raptor_2026";
  const organizerId = "usr_org_1";
  const participantId = "usr_part_1"; // Member of team1 with submitted submission
  let issuedCertCode: string = "";
  let issuedCertId: string = "";

  afterAll(async () => {
    if (issuedCertId) {
      await prisma.certificate.deleteMany({
        where: { id: issuedCertId },
      });
    }
  });

  it("evaluates eligibility and issues a valid participation certificate", async () => {
    // Clean any pre-existing certificate for this test
    await prisma.certificate.deleteMany({
      where: { eventId, recipientId: participantId, type: "PARTICIPATION" },
    });

    const cert = await certificateService.issueCertificate(eventId, organizerId, {
      recipientId: participantId,
      type: "PARTICIPATION",
      title: "Certificate of Participation",
    });

    expect(cert).toBeDefined();
    expect(cert.id).toBeDefined();
    expect(cert.isRevoked).toBe(false);
    expect(cert.verificationId).toMatch(/^RAPTOR-CERT-202[0-9]-PARTICIPATION-[0-9a-f]{12}$/);

    issuedCertCode = cert.verificationId;
    issuedCertId = cert.id;
  });

  it("verifies the issued certificate publicly via API route", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/certificates/verify/${issuedCertCode}`
    );
    const res = await verifyRoute(req, {
      params: Promise.resolve({ verificationCode: issuedCertCode }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.status).toBe("VALID");
    expect(body.data.certificate).toBeDefined();
    expect(body.data.certificate.recipientName).toBe("Elena Builder");
    expect(body.data.certificate.eventName).toBe("Raptor Hack 2026");
    expect(body.data.certificate.type).toBe("PARTICIPATION");
  });

  it("revokes an existing certificate with reason", async () => {
    const revoked = await certificateService.revokeCertificate(
      eventId,
      issuedCertId,
      organizerId,
      "Code of conduct investigation outcome"
    );

    expect(revoked.isRevoked).toBe(true);
    expect(revoked.revocationReason).toBe("Code of conduct investigation outcome");
  });

  it("returns REVOKED status on public verification for revoked certificates", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/certificates/verify/${issuedCertCode}`
    );
    const res = await verifyRoute(req, {
      params: Promise.resolve({ verificationCode: issuedCertCode }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.status).toBe("REVOKED");
    expect(body.data.certificate).toBeDefined();
    expect(body.data.certificate.isRevoked).toBe(true);
    expect(body.data.certificate.revocationReason).toBe("Code of conduct investigation outcome");
  });

  it("returns NOT_FOUND status for non-existent verification codes", async () => {
    const fakeCode = "RAPTOR-CERT-2026-PARTICIPATION-000000000000";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/certificates/verify/${fakeCode}`
    );
    const res = await verifyRoute(req, {
      params: Promise.resolve({ verificationCode: fakeCode }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.status).toBe("NOT_FOUND");
    expect(body.data.certificate).toBeUndefined();
  });
});
