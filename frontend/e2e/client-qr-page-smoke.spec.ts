import { expect, test } from "@playwright/test";
import { installFakeAdminSession } from "./fake-session";

test.describe("Client QR page smoke", () => {
  test.beforeEach(async ({ context }) => {
    await installFakeAdminSession(context);
  });

  test("страница /clients/qr открывается без редиректа на /login", async ({ page }) => {
    await page.goto("/clients/qr", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toBe("/login");
    await expect(page.getByRole("heading", { name: "QR коды клиентов" })).toBeVisible();
  });
});
