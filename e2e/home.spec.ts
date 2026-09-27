import { test, expect } from "@playwright/test";

test.describe("RaptorOS Application Shell & System Diagnostics", () => {
  test("renders homepage, branding, and verifies interactive system status", async ({ page }) => {
    // 1. Open the homepage
    await page.goto("/");

    // 2. Verify branding and Devfolio-grade hero
    await expect(page.getByRole("heading", { name: /BUILD\. SHIP\./i, level: 1 })).toBeVisible();
    await expect(page.getByText(/JUDGE WITH FAIRNESS/i)).toBeVisible();
    await expect(page.getByText(/RaptorOS is the self-hostable, offline-first operating system/i)).toBeVisible();

    // 3. Verify top navigation bar and CTAs
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("link", { name: /explore hackathons/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /project gallery/i })).toBeVisible();

    // 4. Verify interactive Terminal HUD
    await expect(page.getByText(/01_event_telemetry\.sh/i)).toBeVisible();
    await expect(page.getByText(/02_ship_project\.sh/i)).toBeVisible();
    await expect(page.getByText(/03_peer_scoring\.sh/i)).toBeVisible();

    // Test interactivity: click the 02_ship_project.sh tab
    await page.getByRole("button", { name: /02_ship_project\.sh/i }).click();
    await expect(page.getByText(/raptor submit/i)).toBeVisible();

    // 5. Verify live metrics ticker
    await expect(page.getByText("Active Builders")).toBeVisible();
    await expect(page.getByText("Offline-First", { exact: true })).toBeVisible();
  });

  test("health API returns structured JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("raptoros");
    expect(data.database).toBe("ok");
    expect(typeof data.latencyMs).toBe("number");
  });
});
