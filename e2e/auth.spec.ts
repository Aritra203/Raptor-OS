import { test, expect } from "@playwright/test";

test.describe("RaptorOS Authentication & RBAC Flows", () => {
  const testEmail = `e2e_user_${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  const testName = "EndToEnd User";

  test("allows a new user to register and redirects to account page", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: /create.*account/i })).toBeVisible();

    await page.locator("#name").fill(testName);
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator("#confirmPassword").fill(testPassword);

    await page.getByRole("button", { name: /create account/i }).click();

    // After registration, redirected to /account
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Account & Security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: testName })).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();

    // Header should display the user's name
    await expect(page.getByRole("banner").getByText(testName, { exact: false })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: /log out/i })).toBeVisible();
  });

  test("displays error on invalid login credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill("nonexistent@example.com");
    await page.locator("#password").fill("WrongPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("allows seeded user to log in and displays event roles", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#email").fill("admin@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: "Account & Security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alice Admin" })).toBeVisible();
    await expect(page.getByText("admin@raptoros.internal")).toBeVisible();

    // Verify event memberships with event-scoped roles are displayed
    await expect(page.locator("#main-content").getByText("ADMIN", { exact: true })).toBeVisible();
  });

  test("allows an authenticated user to log out", async ({ page }) => {
    // Log in first
    await page.goto("/login");
    await page.locator("#email").fill("admin@raptoros.internal");
    await page.locator("#password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/account/);

    // Click Log Out in banner
    await page.getByRole("banner").getByRole("button", { name: /log out/i }).click();

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    // Visiting homepage should show unauthenticated navigation
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: "Log In" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("unauthenticated user accessing /account is redirected to /login", async ({ page, context }) => {
    // Ensure clean state
    await context.clearCookies();

    await page.goto("/account");
    await expect(page).toHaveURL(/\/login\?redirect=\/account/);
  });
});
