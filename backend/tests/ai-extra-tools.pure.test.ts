/** Pure logic tests — qo'shimcha o'qish tool'lari (no DB). */
import { describe, it, expect } from "vitest";
import { READ_TOOLS_EXTRA } from "../src/modules/ai/ai.tools.read.extra";

describe("READ_TOOLS_EXTRA catalog", () => {
  const ids = READ_TOOLS_EXTRA.map((t) => t.id);

  it("8 ta qo'shimcha o'qish tool bor", () => {
    expect(ids.length).toBe(8);
  });

  it("har birida id, kind, domain, anyOf, schema, path, format bor", () => {
    for (const tool of READ_TOOLS_EXTRA) {
      expect(tool.id).toBeDefined();
      expect(tool.kind).toBe("read");
      expect(tool.domain).toBeDefined();
      expect(Array.isArray(tool.anyOf)).toBe(true);
      expect(tool.schema).toBeDefined();
      expect(typeof tool.path).toBe("function");
      expect(typeof tool.format).toBe("function");
    }
  });

  it("orders.detail → order_id schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "orders.detail");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ order_id: 123 });
    expect(parsed.success).toBe(true);
    const bad = tool!.schema.safeParse({ order_id: -1 });
    expect(bad.success).toBe(false);
  });

  it("returns.detail → return_id schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "returns.detail");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ return_id: 7 });
    expect(parsed.success).toBe(true);
  });

  it("consignment.list → period schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "consignment.list");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ from: "2026-11-01", to: "2026-11-12" });
    expect(parsed.success).toBe(true);
  });

  it("branch.stats → branch_id optional", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "branch.stats");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ branch_id: 5 });
    expect(parsed.success).toBe(true);
    const parsed2 = tool!.schema.safeParse({});
    expect(parsed2.success).toBe(true);
  });

  it("tabel.list → year/month required", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "tabel.list");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ year: 2026, month: 11 });
    expect(parsed.success).toBe(true);
    const bad = tool!.schema.safeParse({ year: 2026 });
    expect(bad.success).toBe(false);
  });

  it("kpi.plan → period schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "kpi.plan");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ from: "2026-11-01", to: "2026-11-30" });
    expect(parsed.success).toBe(true);
  });

  it("price.matrix → search/limit schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "price.matrix");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ search: "Olma", limit: 10 });
    expect(parsed.success).toBe(true);
  });

  it("inventory.turnover → period schema", () => {
    const tool = READ_TOOLS_EXTRA.find((t) => t.id === "inventory.turnover");
    expect(tool).toBeDefined();
    const parsed = tool!.schema.safeParse({ from: "2026-10-01", to: "2026-10-31" });
    expect(parsed.success).toBe(true);
  });

  it("paths to'g'ri quriladi", () => {
    const ordersDetail = READ_TOOLS_EXTRA.find((t) => t.id === "orders.detail")!;
    expect(ordersDetail.path({ order_id: 42 })).toBe("/orders/42");

    const tabel = READ_TOOLS_EXTRA.find((t) => t.id === "tabel.list")!;
    expect(tabel.path({ year: 2026, month: 11 })).toContain("year=2026");
    expect(tabel.path({ year: 2026, month: 11 })).toContain("month=11");

    const priceMatrix = READ_TOOLS_EXTRA.find((t) => t.id === "price.matrix")!;
    expect(priceMatrix.path({ search: "Olma" })).toContain("search=Olma");
  });
});
