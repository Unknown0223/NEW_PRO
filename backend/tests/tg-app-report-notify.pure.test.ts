import { describe, expect, it } from "vitest";
import { extractReportSpec, pivotAggregate, savedPeriod, withPeriod } from "../src/modules/tg-app/tg-report.pure";
import { classifyNotification, isQuietNow, staffRefKey } from "../src/modules/tg-app/tg-notify";
import { diffConsignment } from "../src/modules/consignment/consignment.notify";

describe("extractReportSpec", () => {
  it("reads salec pivot wrapper", () => {
    const spec = extractReportSpec({
      salecPivotConfig: {
        rows: ["agent_name"],
        values: [{ fieldId: "amount", aggregation: "sum" }, { field: "order_id", aggregation: "distinct count" }]
      },
      savdoDatasetFilters: { datasetId: "orders_sales_lines", dateFrom: "2026-01-01", dateTo: "2026-01-31" }
    });
    expect(spec).toEqual({
      kind: "pivot",
      filters: { datasetId: "orders_sales_lines", dateFrom: "2026-01-01", dateTo: "2026-01-31" },
      rows: ["agent_name"],
      values: [
        { field: "amount", agg: "SUM" },
        { field: "order_id", agg: "COUNT_DISTINCT" }
      ]
    });
    expect(savedPeriod(spec!)).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("reads WDR slice and skips measures pseudo-row", () => {
    const spec = extractReportSpec({
      dataSource: { type: "json" },
      slice: {
        rows: [{ uniqueName: "client_name" }, { uniqueName: "[Measures]" }],
        measures: [{ uniqueName: "qty", aggregation: "average" }]
      },
      datasetId: "orders_sales_lines",
      agentIds: [1, 2]
    });
    expect(spec).toMatchObject({ kind: "pivot", rows: ["client_name"], values: [{ field: "qty", agg: "AVG" }] });
    expect(spec && spec.kind === "pivot" ? spec.filters : null).toEqual({ datasetId: "orders_sales_lines", agentIds: [1, 2] });
  });

  it("reads legacy configs and rejects garbage", () => {
    expect(extractReportSpec({ datasetId: "orders", dateFrom: "x" })).toMatchObject({ kind: "legacy" });
    expect(extractReportSpec(null)).toBeNull();
    expect(extractReportSpec([1])).toBeNull();
    expect(extractReportSpec({ foo: 1 })).toBeNull();
  });

  it("withPeriod overrides dates and sets dataset defaults", () => {
    const legacy = withPeriod({ kind: "legacy", config: { datasetId: "o" } }, "2026-02-01", "2026-02-28");
    expect(legacy).toEqual({ kind: "legacy", config: { datasetId: "o", dateFrom: "2026-02-01", dateTo: "2026-02-28" } });
    const pivot = withPeriod({ kind: "pivot", filters: {}, rows: [], values: [] }, "2026-02-01", "2026-02-28");
    expect(pivot.kind === "pivot" ? pivot.filters : null).toEqual({
      datasetId: "orders_sales_lines",
      dateMode: "order_date",
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28"
    });
    expect(savedPeriod({ kind: "legacy", config: { dateFrom: "bad", dateTo: "2026-01-01" } })).toBeNull();
  });
});

describe("pivotAggregate", () => {
  const rows = [
    { agent: "A", amount: 100, order: 1 },
    { agent: "A", amount: "50,5", order: 1 },
    { agent: "B", amount: 300, order: 2 },
    { agent: null, amount: 10, order: 3 },
    { agent: "B", amount: "", order: 4 }
  ];

  it("groups, aggregates and sorts by first value desc", () => {
    const r = pivotAggregate(rows, ["agent"], [
      { field: "amount", agg: "SUM" },
      { field: "order", agg: "COUNT_DISTINCT" },
      { field: "amount", agg: "AVG" }
    ]);
    expect(r.rowCount).toBe(5);
    expect(r.groups.map((g) => g.keys[0])).toEqual(["B", "A", "—"]);
    expect(r.groups[0].values).toEqual([300, 2, 300]);
    expect(r.groups[1].values).toEqual([150.5, 1, 75.25]);
    expect(r.totals[0]).toBeCloseTo(460.5);
    expect(r.totals[1]).toBe(4);
  });

  it("min/max/count and empty value list falls back to row count", () => {
    const r = pivotAggregate(rows, ["agent"], [
      { field: "amount", agg: "MAX" },
      { field: "amount", agg: "MIN" },
      { field: "amount", agg: "COUNT" }
    ]);
    expect(r.groups.find((g) => g.keys[0] === "A")?.values).toEqual([100, 50.5, 2]);
    const c = pivotAggregate(rows, [], []);
    expect(c.groups).toEqual([{ keys: [], values: [5] }]);
  });
});

describe("notification classification", () => {
  it("classifies by link and title", () => {
    expect(classifyNotification("/users/advances", "✅ Аванс утверждён")).toBe("payroll");
    expect(classifyNotification("/users/advances", "💵 Зарплата за 09.2026 подтверждена")).toBe("payroll");
    expect(classifyNotification("/bonus-rules/5", "Бонус изменён")).toBe("bonus");
    expect(classifyNotification("/client-balances/consignment", "Лимит")).toBe("consignment");
    expect(classifyNotification("/tasks", "Новая задача")).toBe("task");
    expect(classifyNotification("/payments/1", "Оплата")).toBe("payment");
    expect(classifyNotification("/orders/5", "Статус")).toBe("order");
    expect(classifyNotification("/stock", "Мало остатков")).toBe("other");
    expect(classifyNotification(null)).toBe("other");
  });

  it("replaces only status-tracked objects", () => {
    expect(staffRefKey("/orders/15")).toBe("n:orders:15");
    expect(staffRefKey("/orders/15?tab=items")).toBe("n:orders:15");
    expect(staffRefKey("/payments/7")).toBe("n:payments:7");
    expect(staffRefKey("/tasks/3")).toBe("n:tasks:3");
    expect(staffRefKey("/clients/5")).toBeNull();
    expect(staffRefKey("/orders/15x")).toBeNull();
    expect(staffRefKey("/users/advances")).toBeNull();
    expect(staffRefKey(null)).toBeNull();
  });

  it("quiet hours 22:00-08:00 local (UTC+5)", () => {
    expect(isQuietNow(false, new Date("2026-09-30T20:00:00Z"))).toBe(false);
    expect(isQuietNow(true, new Date("2026-09-30T17:00:00Z"))).toBe(true);
    expect(isQuietNow(true, new Date("2026-09-30T02:59:00Z"))).toBe(true);
    expect(isQuietNow(true, new Date("2026-09-30T03:00:00Z"))).toBe(false);
    expect(isQuietNow(true, new Date("2026-09-30T16:59:00Z"))).toBe(false);
  });
});

describe("diffConsignment", () => {
  it("detects open / close / limit changes", () => {
    expect(diffConsignment(undefined, { consignment: true, limit: "1" })).toBeNull();
    expect(diffConsignment({ consignment: false, limit: null }, { consignment: true, limit: "5000000" })?.title).toContain("открыта");
    expect(diffConsignment({ consignment: true, limit: "1" }, { consignment: false, limit: "1" })?.title).toContain("закрыта");
    expect(diffConsignment({ consignment: true, limit: "100" }, { consignment: true, limit: "200" })?.title).toContain("📈");
    expect(diffConsignment({ consignment: true, limit: "200" }, { consignment: true, limit: "100" })?.title).toContain("📉");
    expect(diffConsignment({ consignment: true, limit: "200" }, { consignment: true, limit: null })?.title).toContain("📈");
    expect(diffConsignment({ consignment: true, limit: "200.00" }, { consignment: true, limit: "200" })).toBeNull();
    expect(diffConsignment({ consignment: false, limit: "1" }, { consignment: false, limit: "2" })).toBeNull();
  });
});
