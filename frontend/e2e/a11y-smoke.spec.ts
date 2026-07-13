import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installFakeAdminSession } from "./fake-session";

test.describe("A11y smoke", () => {
  test("dashboard has no critical axe violations", async ({ page, context }) => {
    await installFakeAdminSession(context);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Панель управления" })).toBeVisible({
      timeout: 20_000
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
