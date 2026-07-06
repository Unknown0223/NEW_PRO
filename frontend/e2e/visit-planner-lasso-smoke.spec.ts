import { expect, test } from "@playwright/test";
import { installFakeAdminSession } from "./fake-session";

/**
 * «Назначение визитов на карте» — kursor bilan chizish (lasso) ishlashini tekshiradi.
 *
 * Yandex xaritasiga bog'liq emas: canvas overlay sichqoncha hodisalarini olib,
 * ko'pburchak chizadimi va lasso quvuri (finishLasso → toast) ishlaydimi — shu tekshiriladi.
 * Barcha API so'rovlari brauzer darajasida (CORS bilan) mock qilinadi.
 *
 * Eslatma: Playwright chromium yo'q bo'lsa, tizim brauzeri bilan ishga tushiring:
 *   PW_CHANNEL=msedge npx playwright test e2e/visit-planner-lasso-smoke.spec.ts
 */

const PW_CHANNEL = process.env.PW_CHANNEL;
if (PW_CHANNEL) test.use({ channel: PW_CHANNEL });

const FAKE_CLIENTS = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  name: `Klient ${i + 1}`,
  latitude: (41.28 + i * 0.01).toFixed(6),
  longitude: (69.2 + i * 0.01).toFixed(6),
  address: `Manzil ${i + 1}`,
  phone: "998900000000",
  region: "Toshkent",
  city: "Toshkent",
  is_active: true,
  account_balance: "0",
  agent_id: null,
  agent_assignments: []
}));

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "*"
};

test.describe("Visit planner lasso (kursor bilan chizish)", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ context, page }) => {
    await installFakeAdminSession(context);

    await page.route(/127\.0\.0\.1:18080\//, (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const p = url.pathname;
      const send = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: CORS_HEADERS,
          body: JSON.stringify(body)
        });

      if (req.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS_HEADERS, body: "" });
      }
      if (p.endsWith("/auth/me")) {
        return send({
          user: { id: 1, name: "Admin", login: "admin", role: "admin", tenantId: 1, tenantSlug: "test1" }
        });
      }
      if (p.endsWith("/auth/refresh")) return send({ accessToken: "e2e-access", refreshToken: "e2e-refresh" });
      if (p.includes("/clients") && url.searchParams.get("map")) {
        return send({ data: FAKE_CLIENTS, total: FAKE_CLIENTS.length });
      }
      if (p.endsWith("/agents") || p.endsWith("/expeditors")) return send({ data: [] });
      if (p.endsWith("/notifications")) return send({ data: [] });
      if (p.endsWith("/pending-count")) return send({ count: 0 });
      if (p.endsWith("/me-permissions")) return send({ permissions: [] });
      if (p.endsWith("/ui-preferences")) return send({});
      return send({});
    });
  });

  test("lasso faollashtirilganda kursor bilan chizadi va tanlash quvuri ishlaydi", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/clients/visit-planner", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".vp-app")).toBeVisible();
    await expect(page.locator(".vp-filterbar")).toBeVisible({ timeout: 30_000 });

    const canvas = page.locator("canvas.vp-canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).not.toHaveClass(/vp-active/);

    // Lasso asbobini yoqamiz (tagidagi tooltip: "Probel bosib chizing")
    await page.locator('.vp-tool[title="Probel bosib chizing"]').click();
    await expect(canvas).toHaveClass(/vp-active/);

    // Xarita hududida ko'pburchak chizamiz
    const poly = [
      { x: 520, y: 280 },
      { x: 760, y: 280 },
      { x: 760, y: 470 },
      { x: 520, y: 470 }
    ];
    await page.mouse.move(poly[0]!.x, poly[0]!.y);
    await page.mouse.down();
    for (const pt of poly.slice(1)) {
      await page.mouse.move(pt.x, pt.y, { steps: 8 });
    }
    await page.mouse.move(poly[0]!.x, poly[0]!.y, { steps: 8 });

    // Sichqoncha hali bosilgan — chizilgan piksellar bo'lishi kerak (kursor bilan chizish)
    const alphaPixels = await page.evaluate(() => {
      const cv = document.querySelector("canvas.vp-canvas") as HTMLCanvasElement | null;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return 0;
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
      return n;
    });

    await page.mouse.up();

    expect(alphaPixels, "lasso chizig'i canvasda chizilishi kerak").toBeGreaterThan(0);

    // mouseup → finishLasso ishga tushib natija toast'ini ko'rsatadi (quvur to'liq ishladi)
    await expect(page.locator(".vp-toast")).toBeVisible({ timeout: 5000 });
  });
});
