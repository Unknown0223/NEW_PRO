/**
 * ADR-008 M1.1: OrderCreate status SSOT + orphan context.
 * Call site’da qayta status map yo‘q.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { orderStatusLabelRu } from "@/components/orders/order-create/utils";

const orderCreateRoot = join(__dirname, "../components/orders/order-create");

describe("OrderCreate M1.1 status SSOT + orphan", () => {
  it("orderStatusLabelRu delegates to lib/order-status (canonical list text)", () => {
    expect(orderStatusLabelRu("delivering")).toBe(ORDER_STATUS_LABELS.delivering);
    expect(orderStatusLabelRu("returned")).toBe(ORDER_STATUS_LABELS.returned);
    expect(orderStatusLabelRu("delivering")).toBe("Отгружен");
    expect(orderStatusLabelRu("returned")).toBe("Возврат");
    expect(orderStatusLabelRu("DELIVERED")).toBe(ORDER_STATUS_LABELS.delivered);
  });

  it("orphan order-create-context.tsx is gone", () => {
    expect(existsSync(join(orderCreateRoot, "context/order-create-context.tsx"))).toBe(false);
    expect(existsSync(join(orderCreateRoot, "context"))).toBe(false);
  });

  it("create has no local ORDER_STATUS_LABEL_RU map; utils delegates to lib", () => {
    const constants = readFileSync(join(orderCreateRoot, "constants.ts"), "utf8");
    const utils = readFileSync(join(orderCreateRoot, "utils.ts"), "utf8");

    expect(constants).not.toMatch(/ORDER_STATUS_LABEL_RU/);
    expect(utils).not.toMatch(/ORDER_STATUS_LABEL_RU/);
    expect(utils).toMatch(/from ["']@\/lib\/order-status["']/);
    expect(utils).toMatch(/ORDER_STATUS_LABELS/);
  });
});
