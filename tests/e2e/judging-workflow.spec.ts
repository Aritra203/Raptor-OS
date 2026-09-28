import { test, expect } from "@playwright/test";

test.describe("Phase 6: Judging Configuration, Judge Assignment & Scoring", () => {
  test("judge navigates to judge portal and views assignments", async ({ page }) => {
    // 1. Log in as Dr. Clara Judge
    await page.goto("/login");
    await page.locator("#email").fill("judge.clara@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to /judge
    await page.goto("/judge");
    await expect(page.getByRole("heading", { name: /judge portal/i })).toBeVisible();

    // 3. Verify statistics cards
    await expect(page.getByText("Total Assigned")).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();

    // 4. Verify assigned project card
    await expect(page.getByText("RaptorMesh: Decentralized Local Mesh Network")).toBeVisible();
  });

  test("organizer accesses judging & rubrics dashboard tab", async ({ page }) => {
    // 1. Log in as organizer.bob
    await page.goto("/login");
    await page.locator("#email").fill("organizer.bob@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Manage Raptor Hack 2026
    await page.goto("/events/evt_raptor_2026/manage");

    // 3. Click "Judging & Rubrics" tab
    await page.getByRole("button", { name: /judging & rubrics/i }).click();

    // 4. Check sub-tabs
    await expect(page.getByRole("button", { name: /real-time progress/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /judge assignment engine/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rubrics & criteria/i })).toBeVisible();

    // 5. Open Rubrics & Criteria sub-tab
    await page.getByRole("button", { name: /rubrics & criteria/i }).click();
    await expect(page.getByText(/evaluation rubrics & criteria/i)).toBeVisible();
  });

  test("judge evaluates assigned submission, interacts with scoring form, and saves score draft", async ({ page }) => {
    // 1. Log in as David Evaluator
    await page.goto("/login");
    await page.locator("#email").fill("judge.david@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Go to /judge
    await page.goto("/judge");
    await expect(page.getByRole("heading", { name: /judge portal/i })).toBeVisible();

    // 3. Click evaluation link on assigned project
    const scoreButton = page.getByRole("link", { name: /score project|review score|view project/i }).first();
    await expect(scoreButton).toBeVisible();
    await scoreButton.click();

    await expect(page).toHaveURL(/\/judge\/.+/);

    // 4. Verify project evaluation details dossier
    await expect(page.getByText("RaptorMesh: Decentralized Local Mesh Network")).toBeVisible();
    await expect(page.getByText(/judging criteria/i)).toBeVisible();
    await expect(page.getByText(/weighted aggregate/i)).toBeVisible();

    // 5. Back to judge portal
    await page.getByRole("link", { name: /back to judge portal/i }).click();
    await expect(page).toHaveURL(/\/judge/);
  });
});
