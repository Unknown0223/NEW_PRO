import { expect, test } from "@playwright/test";

test.describe("Order edit header lock", () => {
  test("tahrirda agent va ombor zakazdan to‘ladi, qulflanadi, Saqlash yonadi", async ({
    page
  }) => {
    const slug = process.env.E2E_TENANT_SLUG?.trim() || "test1";
    const login = process.env.E2E_LOGIN?.trim() || "admin";
    const password = process.env.E2E_PASSWORD?.trim() || "secret123";

    const loginRes = await page.request.post("http://127.0.0.1:18080/api/auth/login", {
      data: { slug, login, password }
    });
    expect(loginRes.ok(), `login ${loginRes.status()}`).toBeTruthy();
    const auth = (await loginRes.json()) as { accessToken?: string };
    expect(auth.accessToken).toBeTruthy();

    const ordersRes = await page.request.get(
      `http://127.0.0.1:18080/api/${slug}/orders?page=1&limit=20&status=new`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } }
    );
    expect(ordersRes.ok()).toBeTruthy();
    const body = (await ordersRes.json()) as {
      data?: Array<{ id: number; agent_id?: number | null; agent_name?: string | null }>;
    };
    const row = (body.data ?? []).find((o) => o.agent_id != null && o.agent_id > 0);
    expect(row, "Yangi zakazda agent bo‘lishi kerak").toBeTruthy();

    await page.context().addCookies([
      { name: "sd_auth", value: "1", url: "http://127.0.0.1:3000" }
    ]);
    await page.addInitScript(
      ({ token, tenant }) => {
        localStorage.setItem(
          "savdo-auth",
          JSON.stringify({
            state: { accessToken: token, tenantSlug: tenant, role: "admin" },
            version: 0
          })
        );
      },
      { token: auth.accessToken, tenant: slug }
    );

    await page.goto(`/orders/new?edit_order_id=${row!.id}`);
    await expect(page.getByRole("heading", { name: /Zakazni tahrirlash/ })).toBeVisible({
      timeout: 20_000
    });

    const agent = page.locator("#oc-agent");
    await expect(agent).toBeVisible();
    await expect(agent).toHaveAttribute("readonly", "");
    await expect(agent).not.toHaveValue(/^(\s*|—)$/);
    if (row!.agent_name?.trim()) {
      await expect(agent).toHaveValue(
        new RegExp(row!.agent_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      );
    }

    const warehouse = page.locator("#oc-warehouse");
    await expect(warehouse).toHaveAttribute("readonly", "");
    await expect(warehouse).not.toHaveValue(/^(\s*|—|Omborni tanlang)$/);

    await expect(page.getByText("Tahrirda ombor o‘zgartirilmaydi.")).toBeVisible();
    await expect(page.getByText("Tahrirda agent o‘zgartirilmaydi.")).toBeVisible();

    const pay = page.getByTestId("order-create-payment-method");
    if (await pay.isVisible()) {
      const current = await pay.inputValue();
      if (!current.trim()) {
        const opt = pay.locator("option").nth(1);
        const val = await opt.getAttribute("value");
        if (val) await pay.selectOption(val);
      }
    }

    await expect(page.getByTestId("order-create-submit")).toBeEnabled({ timeout: 30_000 });
  });
});
