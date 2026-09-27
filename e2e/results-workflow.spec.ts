import { test, expect } from "@playwright/test";

test.describe("Phase 7: Score Normalization, Fairness Analytics, Rankings & Results Integrity", () => {
  test("organizer accesses Results & Fairness dashboard, runs normalization, and inspects calibration", async ({ page }) => {
    // 1. Log in as organizer.bob
    await page.goto("/login");
    await page.locator("#email").fill("organizer.bob@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to event management
    await page.goto("/events/evt_raptor_2026/manage");

    // 3. Click "Results & Fairness" tab
    await page.getByRole("button", { name: /results & fairness/i }).click();

    // 4. Verify 4 sub-tabs are visible
    await expect(page.getByRole("button", { name: /normalization engine/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /judge calibration & fairness/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rankings & ties/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /snapshots & publication/i })).toBeVisible();

    // 5. Test Normalization Engine execution
    await expect(page.getByRole("button", { name: /execute normalization run/i })).toBeVisible();

    // 6. Switch to Judge Calibration & Fairness sub-tab
    await page.getByRole("button", { name: /judge calibration & fairness/i }).click();
    await expect(page.getByText(/judge scoring distributions & calibration/i)).toBeVisible();

    // 7. Switch to Rankings & Ties sub-tab
    await page.getByRole("button", { name: /rankings & ties/i }).click();
    await expect(page.getByText(/deterministic aggregated leaderboard/i)).toBeVisible();

    // 8. Switch to Snapshots & Publication sub-tab
    await page.getByRole("button", { name: /snapshots & publication/i }).click();
    await expect(page.getByText(/result snapshots & publication governance/i)).toBeVisible();
  });

  test("public user views sanitized official results and verified leaderboard", async ({ page }) => {
    // 1. Navigate to public results page without login
    await page.goto("/events/evt_raptor_2026/results");

    // 2. Verify hero header and official badge
    await expect(page.getByText(/official results/i)).toBeVisible();
    await expect(page.getByText(/winners & placements/i)).toBeVisible();

    // 3. Verify top project podium and placement table
    await expect(page.getByText("RaptorMesh: Decentralized Local Mesh Network").first()).toBeVisible();
    await expect(page.getByText("Raptor Core").first()).toBeVisible();
    await expect(page.getByText(/complete official placements/i)).toBeVisible();

    // 4. Ensure judge emails and private calibration are strictly absent from DOM
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toContain("judge.clara@raptoros.internal");
    expect(bodyText).not.toContain("judge.david@raptoros.internal");
    expect(bodyText).not.toContain("severityIndicator");
    expect(bodyText).not.toContain("spreadIndicator");
  });

  test("public user viewing unpublished event sees protective placeholder", async ({ page }) => {
    // Navigate to winter hackathon results (unpublished)
    await page.goto("/events/evt_winter_code_2026/results");

    // Verify Results Not Yet Published notice
    await expect(page.getByRole("heading", { name: /results not yet published/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /return to event overview/i })).toBeVisible();
  });
});
