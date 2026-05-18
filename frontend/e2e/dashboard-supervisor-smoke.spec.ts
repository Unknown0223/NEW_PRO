import { expect, test } from "@playwright/test";

const apiBase = (process.env.PLAYWRIGHT_API_ORIGIN?.trim() || "http://127.0.0.1:18080").replace(/\/$/, "");
const healthUrl = process.env.PLAYWRIGHT_API_HEALTH_URL?.trim() || `${apiBase}/health`;

async function backendHealthy(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const r = await fetch(healthUrl, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Supervisor dashboard: haqiqiy JWT (API orqali) + cookie/localStorage.
 * Stack: PostgreSQL + API (`PLAYWRIGHT_API_ORIGIN`, default 18080) + `next dev` (3000).
 * Seed: `test1` / `admin` / `secret123` yoki `E2E_*` o‘zgaruvchilari.
 */
test.describe("Supervisor dashboard (to‘liq stack)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("KPI bloki va sarlavha yuklanadi", async ({ page, request }, testInfo) => {
    if (!(await backendHealthy())) {
      testInfo.skip(true, `Backend yo‘q: ${healthUrl} — start-dev.cmd yoki API ishga tushiring`);
    }

    const slug = process.env.E2E_TENANT_SLUG?.trim() || "test1";
    const login = process.env.E2E_LOGIN?.trim() || "admin";
    const password = process.env.E2E_PASSWORD?.trim() || "secret123";

    const loginRes = await request.post(`${apiBase}/auth/login`, {
      data: { slug, login, password },
      headers: { "Content-Type": "application/json" }
    });
    if (!loginRes.ok()) {
      testInfo.skip(
        true,
        `Login ${loginRes.status()} ${await loginRes.text().catch(() => "")} — DB seed yoki E2E_* tekshiring`
      );
      return;
    }
    const body = (await loginRes.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { role: string };
    };

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([accessToken, refreshToken, tenantSlug, role]) => {
        localStorage.setItem(
          "savdo-auth",
          JSON.stringify({
            state: { accessToken, refreshToken, tenantSlug, role },
            version: 0
          })
        );
        document.cookie = `sd_auth=1;path=/;max-age=${60 * 60 * 24};SameSite=Lax`;
      },
      [body.accessToken, body.refreshToken, slug, body.user.role] as const
    );

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await expect(page.getByRole("heading", { name: /Дашборд.*Супервайзер/i })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole("heading", { name: "Ключевые показатели" })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByText("Общая сумма", { exact: true })).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        async () => {
          if (await page.getByText("Не удалось загрузить дашборд.").isVisible()) {
            return "error" as const;
          }
          if (await page.getByText("Загрузка данных…").isVisible()) {
            return "loading" as const;
          }
          return "ok" as const;
        },
        { timeout: 90_000 }
      )
      .toBe("ok");
  });
});
