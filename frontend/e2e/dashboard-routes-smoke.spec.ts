import { expect, test } from "@playwright/test";
import { installFakeAdminSession } from "./fake-session";

/**
 * Har bir URL ochiladi va `/login` ga qaytmasligi tekshiriladi.
 * API bo‘lmasa ba’zi sahifalar xato blokini ko‘rsatishi mumkin — bu test uchun qabul qilinadi.
 */
const CORE_PANEL_PATHS = [
  "/dashboard",
  "/orders",
  "/orders/new",
  "/clients",
  "/clients/map",
  "/products",
  "/orders/automation",
  "/returns",
  "/payments",
  "/currency-rates",
  "/expenses",
  "/reports",
  "/reports/builder",
  "/reports/cash-flow",
  "/reports/client-reconciliation",
  "/settings/cash-desks",
  "/settings",
  "/settings/spravochnik",
  "/settings/spravochnik/agents",
  "/settings/spravochnik/expeditors",
  "/settings/spravochnik/supervisors",
  "/settings/spravochnik/operators",
  "/stock",
  "/stock/correction",
  "/stock/receipts",
  "/stock/transfers",
  "/stock/warehouses",
  "/stock/blocks",
  "/stock/balances",
  "/stock/material-report",
  "/stock/recommended",
  "/stock/by-date",
  "/stock/receipts-report",
  "/suppliers",
  "/suppliers/payments",
  "/suppliers/balances",
  "/suppliers/reconciliation"
] as const;

test.describe("Dashboard routes smoke (FAZA 10)", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ context }) => {
    await installFakeAdminSession(context);
  });

  test("asosiy panel marshrutlari ochiladi (login emas)", async ({ page }) => {
    for (const path of CORE_PANEL_PATHS) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const pathname = new URL(page.url()).pathname;
        expect(pathname, `kutilgan yo‘l: ${path}, olingan: ${page.url()}`).not.toBe("/login");
        expect(page.url()).not.toMatch(/\/login\?/);
      });
    }
  });
});
