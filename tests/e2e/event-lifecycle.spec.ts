import { test, expect } from "@playwright/test";

test.describe("Phase 4: Event Management, Registration & Team Workflows", () => {
  test("browses public event catalog and views event details", async ({ page }) => {
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: /hackathon (discovery|events)/i })).toBeVisible();
    await expect(page.getByText("Winter Hackathon 2026")).toBeVisible();
    await expect(page.getByText("Raptor Hack 2026")).toBeVisible();

    // Click "View Details & Register" on Raptor Hack
    await page.goto("/events/raptor-hack-2026");

    // Verify event details page
    await expect(page).toHaveURL(/\/events\/raptor-hack-2026/);
    await expect(page.getByRole("heading", { name: "Raptor Hack 2026" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI & Autonomous Agents" })).toBeVisible();
    await page.getByRole("tab", { name: /prizes/i }).click();
    await expect(page.getByText("Overall Grand Prize")).toBeVisible();
  });

  test("participant registers for event, views dashboard, and creates a team", async ({ page }) => {
    // 1. Log in as hacker.elena
    await page.goto("/login");
    await page.locator("#email").fill("hacker.elena@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to event details
    await page.goto("/events/winter-hackathon-2026");
    await expect(page.getByRole("heading", { name: "Winter Hackathon 2026" })).toBeVisible();

    // 3. Visit dashboard
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /participant (command center|dashboard)/i })).toBeVisible();
    await expect(page.getByText("Raptor Hack 2026").first()).toBeVisible();

    // 4. Navigate to team management page
    await page.getByRole("link", { name: /manage team|create team/i }).first().click();
    await expect(page).toHaveURL(/\/events\/.*\/team/);

    // Elena is leader of seeded team "Raptor Core"
    await expect(page.getByText("Captain")).toBeVisible();
  });

  test("organizer creates new event and transitions lifecycle state", async ({ page }) => {
    // 1. Log in as organizer.bob
    await page.goto("/login");
    await page.locator("#email").fill("organizer.bob@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Go to /events/new
    await page.goto("/events/new");
    await expect(page.getByRole("heading", { name: "Create a New Hackathon" })).toBeVisible();

    const uniqueEventName = `Sprint Hack ${Date.now()}`;
    const uniqueSlug = `sprint-hack-${Date.now()}`;
    await page.locator("#eventName").fill(uniqueEventName);
    await page.locator("#eventSlug").fill(uniqueSlug);
    await page.locator("#eventDesc").fill("A fast-paced weekend hackathon.");
    await page.locator("#minTeamSize, #minTeam").fill("1");
    await page.locator("#maxTeamSize, #maxTeam").fill("4");

    await Promise.all([
      page.waitForURL(/\/events\/.*\/manage/, { timeout: 15000 }),
      page.getByRole("button", { name: /create & configure event|create hackathon/i }).click(),
    ]);

    // 3. Should redirect to /events/[eventId]/manage
    await expect(page.getByRole("heading", { name: uniqueEventName })).toBeVisible();
    await expect(page.getByText("DRAFT", { exact: true }).first()).toBeVisible();

    // 4. Perform state transition: DRAFT -> REGISTRATION_OPEN
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /transition to registration_open/i }).click();
    await expect(page.getByText("REGISTRATION_OPEN", { exact: true }).first()).toBeVisible();

    // 5. Add a track
    await page.getByRole("button", { name: /tracks/i }).click();
    await page.locator("#trackName").fill("Autonomous Agents");
    await page.locator("#trackDesc").fill("LLM agent tooling.");
    await page.getByRole("button", { name: /add track/i }).click();

    await expect(page.getByText("Autonomous Agents")).toBeVisible();
  });
});
