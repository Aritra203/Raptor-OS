import { test, expect } from "@playwright/test";

test.describe("Phase 5: Project Submission Lifecycle & Public Gallery", () => {
  test("browses public gallery, searches, and inspects project detail", async ({ page }) => {
    // 1. Visit public gallery
    await page.goto("/gallery");

    await expect(page.getByRole("heading", { name: "Project Gallery" })).toBeVisible();
    await expect(
      page.getByText(/Explore innovative projects built by participants/i)
    ).toBeVisible();

    // Verify seeded submitted projects are listed
    await expect(page.getByText("RaptorMesh: Decentralized Local Mesh Network")).toBeVisible();
    await expect(page.getByText("Team: Raptor Core")).toBeVisible();

    // 2. Test search functionality
    const searchInput = page.getByPlaceholder(/search projects by title/i);
    await searchInput.fill("RaptorMesh");
    await searchInput.press("Enter");
    await expect(page.getByText("RaptorMesh: Decentralized Local Mesh Network")).toBeVisible();

    // 3. Navigate into project detail
    await page.locator('a[href*="/gallery/sub_mesh_1"]').first().click();
    await expect(page).toHaveURL(/\/gallery\/sub_mesh_1/);

    // Verify detail page elements
    await expect(
      page.getByRole("heading", { name: "RaptorMesh: Decentralized Local Mesh Network" })
    ).toBeVisible();
    await expect(page.getByText("Raptor Core")).toBeVisible();
    await expect(page.getByText(/Track:\s*AI & Autonomous Agents/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /source code/i })).toBeVisible();
  });

  test("authenticated participant views submissions dashboard", async ({ page }) => {
    // 1. Log in as hacker.elena (Captain of Raptor Core)
    await page.goto("/login");
    await page.locator("#email").fill("hacker.elena@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/account/);

    // 2. Navigate to Submissions dashboard
    await page.goto("/dashboard/submissions");
    await expect(page.getByRole("heading", { name: "My Team Submissions" })).toBeVisible();

    // Select Raptor Hack 2026 event
    await page.getByRole("link", { name: "Raptor Hack 2026" }).click();

    // 3. Verify Raptor Core's submission is listed
    await expect(
      page.getByRole("heading", { name: "RaptorMesh: Decentralized Local Mesh Network" })
    ).toBeVisible();
    await expect(page.getByText("SUBMITTED").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view in gallery/i })).toBeVisible();
  });
});
