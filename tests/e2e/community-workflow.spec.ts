import { test, expect } from "@playwright/test";

test.describe("Phase 8: Community Voting, Comments & Anti-Abuse Workflow", () => {
  test.describe.configure({ mode: "serial" });
  test("organizer accesses Community & Voting console, reviews config, results, abuse signals and comments", async ({
    page,
  }) => {
    // 1. Log in as organizer.bob
    await page.goto("/login");
    await page.locator("#email").fill("organizer.bob@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to event management
    await page.goto("/events/evt_raptor_2026/manage");

    // 3. Click "Community & Voting" tab
    await page.getByRole("button", { name: /community & voting/i }).click();

    // 4. Verify 4 sub-tabs are visible
    await expect(
      page.getByRole("button", { name: /voting configuration/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /community results/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /abuse signals/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /comments moderation/i })
    ).toBeVisible();

    // 5. Inspect Voting Configuration sub-tab controls
    await expect(page.getByText(/voting activation & windows/i)).toBeVisible();
    await expect(page.getByText(/eligibility & anti-bias policies/i)).toBeVisible();
    await expect(page.getByText(/deterministic gallery randomization/i)).toBeVisible();

    // 6. Switch to Community Results sub-tab
    await page.getByRole("button", { name: /community results/i }).click();
    await expect(page.getByText(/community choice leaderboard/i)).toBeVisible();

    // 7. Switch to Abuse Signals sub-tab
    await page.getByRole("button", { name: /abuse signals/i }).click();
    await expect(
      page.getByText(/suspicious activity & review queue/i)
    ).toBeVisible();

    // 8. Switch to Comments Moderation sub-tab
    await page.getByRole("button", { name: /comments moderation/i }).click();
    await expect(page.getByText(/submission comments queue/i)).toBeVisible();
  });

  test("participant interacts with voting and comments on project details page", async ({
    page,
  }) => {
    // 1. Log in as hacker.grace (participant)
    await page.goto("/login");
    await page.locator("#email").fill("hacker.grace@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to project details page in gallery
    await page.goto("/gallery/sub_mesh_1");

    // 3. Verify Community Discussion component is rendered
    await expect(page.getByText(/community discussion/i)).toBeVisible();
    await expect(
      page.getByPlaceholder(/leave constructive feedback/i)
    ).toBeVisible();

    // 4. Post a comment
    await page
      .getByPlaceholder(/leave constructive feedback/i)
      .fill("Playwright E2E: Impressive decentralized networking demo!");
    await page.getByRole("button", { name: /post comment/i }).click();

    // 5. Verify the posted comment appears in the feed
    await expect(
      page
        .locator("p", {
          hasText: "Playwright E2E: Impressive decentralized networking demo!",
        })
        .first()
    ).toBeVisible();
  });

  test("public user views gallery project cards with community indicators", async ({
    page,
  }) => {
    // Navigate to public gallery without logging in
    await page.goto("/gallery");

    // Verify page title and header
    await expect(page.getByRole("heading", { name: /project gallery/i })).toBeVisible();

    // Verify submission cards are rendered
    await expect(
      page.getByText("RaptorMesh: Decentralized Local Mesh Network").first()
    ).toBeVisible();
  });
});
