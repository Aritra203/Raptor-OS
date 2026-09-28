import { test, expect } from "@playwright/test";

test.describe("Phase 9: Public Certificate Verification, Embed Gallery & REST API", () => {
  const validCode = "RAPTOR-CERT-2026-WIN-9812A";
  const revokedCode = "RAPTOR-CERT-2026-PAR-REV9901";
  const notFoundCode = "RAPTOR-CERT-2026-PARTICIPATION-000000000000";

  test("verifies valid certificate on the public verification page", async ({ page }) => {
    await page.goto(`/verify/certificate/${validCode}`);

    // Verify heading and status badge
    await expect(page.getByRole("heading", { name: "RaptorOS Verification" })).toBeVisible();
    await expect(page.getByText(/OFFICIALLY VALID/i)).toBeVisible();

    // Verify recipient and event details
    await expect(page.getByText("Elena Builder")).toBeVisible();
    await expect(page.getByText("Raptor Hack 2026", { exact: true })).toBeVisible();
    await expect(page.getByText("RAPTOR-CERT-2026-WIN-9812A")).toBeVisible();
  });

  test("displays REVOKED warning for revoked certificates", async ({ page }) => {
    await page.goto(`/verify/certificate/${revokedCode}`);

    // Verify heading and revoked badge
    await expect(page.getByRole("heading", { name: "RaptorOS Verification" })).toBeVisible();
    await expect(page.getByText("REVOKED", { exact: true })).toBeVisible();

    // Verify revocation notice
    await expect(page.getByText(/Violation of event code of conduct policy/i)).toBeVisible();
  });

  test("displays NOT FOUND message for invalid verification codes", async ({ page }) => {
    await page.goto(`/verify/certificate/${notFoundCode}`);

    // Verify not found heading and text
    await expect(page.getByRole("heading", { name: "Certificate Not Found" })).toBeVisible();
    await expect(
      page.getByText(/No certificate was found matching the code/i)
    ).toBeVisible();
  });

  test("renders embeddable public gallery with project cards", async ({ page }) => {
    await page.goto("/embed/events/evt_raptor_2026/gallery");

    // Verify event title in embed mode
    await expect(page.getByText("Raptor Hack 2026")).toBeVisible();
    await expect(page.getByText("Showcase")).toBeVisible();

    // Verify sidebar is NOT present in embed layout
    await expect(page.getByLabel("Platform Sidebar")).not.toBeVisible();

    // Verify submission card is rendered
    await expect(page.getByText(/RaptorMesh/i)).toBeVisible();
    await expect(page.getByText(/Hosted on RaptorOS/i)).toBeVisible();
  });

  test("REST API v1 endpoints respond with standard format", async ({ request }) => {
    // 1. GET /api/v1/events
    const eventsRes = await request.get("/api/v1/events");
    expect(eventsRes.status()).toBe(200);
    const eventsBody = await eventsRes.json();
    expect(Array.isArray(eventsBody.data)).toBe(true);
    expect(eventsBody.meta).toBeDefined();

    // 2. GET /api/v1/public-key
    const pkRes = await request.get("/api/v1/public-key");
    expect(pkRes.status()).toBe(200);
    const pkBody = await pkRes.json();
    expect(pkBody.data.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(pkBody.data.algorithm).toBe("Ed25519");

    // 3. GET /api/v1/openapi.json
    const oapiRes = await request.get("/api/v1/openapi.json");
    expect(oapiRes.status()).toBe(200);
    const oapiBody = await oapiRes.json();
    expect(oapiBody.openapi).toBe("3.0.3");

    // 4. GET /api/v1/certificates/verify/:code
    const certRes = await request.get(`/api/v1/certificates/verify/${validCode}`);
    expect(certRes.status()).toBe(200);
    const certBody = await certRes.json();
    expect(certBody.data.status).toBe("VALID");
    expect(certBody.data.certificate.recipientName).toBe("Elena Builder");
  });
});
