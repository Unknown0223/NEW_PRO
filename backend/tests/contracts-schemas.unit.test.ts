/**
 * Foundation Sprint 1 — Zod kontraktlar (DBsiz unit testlar).
 */
import { describe, expect, it } from "vitest";
import { authLoginBodySchema } from "../src/contracts/auth.schemas";
import { patchClientBodySchema } from "../src/contracts/clients.schemas";
import {
  createOrderBodySchema,
  ordersListQuerySchema,
  patchOrderStatusBodySchema
} from "../src/contracts/orders.schemas";
import { createPaymentBodySchema, parsePaymentsListQuery } from "../src/contracts/payments.schemas";
import { createProductBodySchema, parseProductsListQuery } from "../src/contracts/products.schemas";
import {
  agentOrdersQuerySchema,
  clientSales2QuerySchema,
  incomeReportQuerySchema,
  productSalesReportQuerySchema,
  parseReportsDateRangeQuery,
  parseReportsReceivablesListQuery,
  parseReportsTopLimitQuery,
  reportsCashFlowQuerySchema
} from "../src/contracts/reports.schemas";
import { stockBalancesQuerySchema } from "../src/contracts/stock.schemas";

describe("contracts schemas (unit)", () => {
  it("createOrderBodySchema — exchange uchun source_order_ids majburiy", () => {
    const r = createOrderBodySchema.safeParse({
      client_id: 1,
      warehouse_id: 1,
      agent_id: 1,
      order_type: "exchange",
      items: []
    });
    expect(r.success).toBe(false);
  });

  it("createOrderBodySchema — oddiy order uchun items va agent", () => {
    const r = createOrderBodySchema.safeParse({
      client_id: 1,
      warehouse_id: 1,
      agent_id: 1,
      items: [{ product_id: 1, qty: 1 }]
    });
    expect(r.success).toBe(true);
  });

  it("patchOrderStatusBodySchema — status majburiy", () => {
    expect(patchOrderStatusBodySchema.safeParse({}).success).toBe(false);
    expect(patchOrderStatusBodySchema.safeParse({ status: "new" }).success).toBe(true);
  });

  it("patchClientBodySchema — bo‘sh body rad etiladi", () => {
    expect(patchClientBodySchema.safeParse({}).success).toBe(false);
    expect(patchClientBodySchema.safeParse({ name: "A" }).success).toBe(true);
  });

  it("createPaymentBodySchema — amount va payment_type majburiy", () => {
    expect(createPaymentBodySchema.safeParse({ client_id: 1 }).success).toBe(false);
    expect(
      createPaymentBodySchema.safeParse({
        client_id: 1,
        amount: 100,
        payment_type: "cash"
      }).success
    ).toBe(true);
  });

  it("createProductBodySchema — category_id majburiy", () => {
    expect(createProductBodySchema.safeParse({ sku: "x", name: "y" }).success).toBe(false);
    expect(
      createProductBodySchema.safeParse({ sku: "x", name: "y", category_id: 1 }).success
    ).toBe(true);
  });

  it("ordersListQuerySchema — default page/limit", () => {
    const r = ordersListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(30);
    }
  });

  it("parsePaymentsListQuery — deal_type filtri", () => {
    const q = parsePaymentsListQuery({ deal_type: "consignment", page: "2", limit: "10" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(10);
    expect(q.deal_type).toBe("consignment");
  });

  it("parseProductsListQuery — uncategorized", () => {
    const q = parseProductsListQuery({ uncategorized: "true", page: "1", limit: "20" });
    expect(q.uncategorized).toBe(true);
    expect(q.limit).toBe(20);
  });

  it("stockBalancesQuerySchema — default view", () => {
    const r = stockBalancesQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.view).toBe("summary");
      expect(r.data.purpose).toBe("sales");
    }
  });

  it("parseReportsDateRangeQuery — from/to trim", () => {
    const q = parseReportsDateRangeQuery({ from: " 2026-01-01 ", to: "" });
    expect(q.from).toBe("2026-01-01");
    expect(q.to).toBeUndefined();
  });

  it("parseReportsTopLimitQuery — limit clamp", () => {
    const q = parseReportsTopLimitQuery({ limit: "999" });
    expect(q.limit).toBe(200);
    expect(parseReportsTopLimitQuery({ limit: "x" }).limit).toBe(20);
  });

  it("parseReportsReceivablesListQuery — page/limit", () => {
    const q = parseReportsReceivablesListQuery({ page: "2", limit: "10", only_over_limit: "true" });
    expect(q.page).toBe(2);
    expect(q.limit).toBe(10);
    expect(q.only_over_limit).toBe(true);
  });

  it("incomeReportQuerySchema — from/to majburiy", () => {
    const bad = incomeReportQuerySchema.safeParse({});
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]?.message).toBe("BAD_RANGE");
    }
    expect(
      incomeReportQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-31" }).success
    ).toBe(true);
  });

  it("agentOrdersQuerySchema — default date_type", () => {
    const r = agentOrdersQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.date_type).toBe("order_date");
      expect(r.data.consignment).toBe("all");
    }
  });

  it("productSalesReportQuerySchema — default from/to va page", () => {
    const r = productSalesReportQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("clientSales2QuerySchema — default page/limit", () => {
    const r = clientSales2QuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(50);
    }
  });

  it("reportsCashFlowQuerySchema — majburiy maydonlar", () => {
    expect(reportsCashFlowQuerySchema.safeParse({}).success).toBe(false);
    expect(
      reportsCashFlowQuerySchema.safeParse({
        from: "2026-01-01",
        to: "2026-01-31",
        cash_desk_id: "1"
      }).success
    ).toBe(true);
  });

  it("authLoginBodySchema — login maydonlari", () => {
    expect(authLoginBodySchema.safeParse({ slug: "t", login: "a" }).success).toBe(false);
    expect(
      authLoginBodySchema.safeParse({ slug: "t", login: "a", password: "p" }).success
    ).toBe(true);
  });
});
