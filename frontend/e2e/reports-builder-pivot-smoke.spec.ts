import { expect, test } from "@playwright/test";
import { installFakeAdminSession } from "./fake-session";

test.describe("Reports builder pivot smoke", () => {
  test.beforeEach(async ({ context }) => {
    await installFakeAdminSession(context);
  });

  test("/reports/builder pivot sahifasi ochiladi", async ({ page }) => {
    await page.goto("/reports/builder/pivot", { waitUntil: "domcontentloaded" });
    const pathname = new URL(page.url()).pathname;
    expect(pathname).not.toBe("/login");
    await expect(page.getByText(/Pivot|konstruktor|конструктор/i).first()).toBeVisible({
      timeout: 30_000
    });
  });

  test("/reports/builder default redirect pivot ga", async ({ page }) => {
    await page.goto("/reports/builder", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/reports\/builder\/pivot/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe("/reports/builder/pivot");
  });
});
