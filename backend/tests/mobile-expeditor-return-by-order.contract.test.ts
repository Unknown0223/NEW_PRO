import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = join(__dirname, "../src/modules/mobile");

describe("mobile expeditor return-by-order contract", () => {
  it("create/preview/list map RETURN_DISABLED to 403 ReturnDisabled", () => {
    const routes = readFileSync(
      join(mobileRoot, "mobile.route.expeditor.returns.ts"),
      "utf8"
    );
    expect(routes).toMatch(/return-by-order/);
    expect(routes).toMatch(/RETURN_DISABLED/);
    expect(routes).toMatch(/ReturnDisabled/);
    expect(routes).toMatch(/createMobileExpeditorReturnByOrder/);
    expect(routes).toMatch(/previewMobileExpeditorReturnByOrder/);
    expect(routes).toMatch(/listMobileExpeditorReturnByOrderOrders/);
  });

  it("service gates shelf return behind allow_return_from_shelf", () => {
    const svc = readFileSync(
      join(mobileRoot, "mobile.expeditor.returns.by-order.ts"),
      "utf8"
    );
    expect(svc).toMatch(/allow_return_from_shelf/);
    expect(svc).toMatch(/RETURN_DISABLED/);
  });

  it("partial return + reload + shelf return use share mutation guard", () => {
    const partial = readFileSync(
      join(mobileRoot, "mobile.expeditor.return-create.ts"),
      "utf8"
    );
    const byOrder = readFileSync(
      join(mobileRoot, "mobile.expeditor.returns.by-order.ts"),
      "utf8"
    );
    const orders = readFileSync(
      join(mobileRoot, "mobile.expeditor.orders.service.ts"),
      "utf8"
    );
    const composition = readFileSync(
      join(mobileRoot, "mobile.expeditor.returns.service.ts"),
      "utf8"
    );
    expect(partial).toMatch(/loadOrderAfterShareGuard/);
    expect(byOrder).toMatch(/loadOrderAfterShareGuard/);
    expect(orders).toMatch(/createMobileExpeditorReloadFromVehicle/);
    expect(orders).toMatch(/loadOrderAfterShareGuard/);
    expect(composition).toMatch(/getMobileExpeditorReturnByOrderComposition/);
    expect(composition).toMatch(/loadOrderAfterShareGuard/);
  });
});
