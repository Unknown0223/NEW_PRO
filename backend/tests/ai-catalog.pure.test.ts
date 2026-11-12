/** Pure logic tests — new catalog intents + tool paths (no DB). */
import { describe, it, expect } from "vitest";
import { detectIntent, extractSlots } from "../src/modules/ai/ai.intent";
import { planFromQuestion } from "../src/modules/ai/ai.plan";
import { READ_TOOLS_EXTRA } from "../src/modules/ai/ai.tools.read.extra";
import { WRITE_TOOLS } from "../src/modules/ai/ai.tools.write";

describe("detectIntent — new read intents", () => {
  const cases: Array<[string, string]> = [
    ["buyurtma #123 tafsilotlari", "orders.detail"],
    ["qaytarish tafsiloti", "returns.detail"],
    ["konsignatsiya qarzlari", "consignment.list"],
    ["bozori ziyoratlar", "reports.visits"],
    ["tabel marks", "tabel.marks"],
    ["kpi plan-rasto", "kpi.plan"],
    ["narx matritsasi", "price.matrix"],
    ["ombor transfer", "stock.transfer"],
    ["narx bo'yicha sana", "price.as-of"]
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    const m = detectIntent(q);
    expect(m.intent).toBe(intent);
    expect(m.score).toBeGreaterThan(0);
  });
});

describe("detectIntent — new write intents", () => {
  const cases: Array<[string, string]> = [
    ["buyurtma holatini o'zgartir", "write.order_status"],
    ["zakaz status tasdiqlandi", "write.order_status"],
    ["mahsulotni yangila", "write.update_product"]
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    const m = detectIntent(q);
    expect(m.intent).toBe(intent);
  });
});

describe("planFromQuestion — new read plans", () => {
  it("orders.detail → order_id slot", () => {
    const built = planFromQuestion("buyurtma #42 tafsilotlari");
    expect(built.intent).toBe("orders.detail");
    expect(built.plan.calls[0]?.tool).toBe("orders.detail");
    expect(built.plan.calls[0]?.params.order_id).toBe(42);
  });

  it("price.as-of → as_of from period", () => {
    const built = planFromQuestion("narx bo'yicha sana 2026-11-01");
    expect(built.intent).toBe("price.as-of");
    expect(built.plan.calls[0]?.tool).toBe("price.as-of");
  });

  it("reports.visits → period", () => {
    const built = planFromQuestion("bozori ziyoratlar shu oy");
    expect(built.intent).toBe("reports.visits");
    expect(built.plan.calls[0]?.tool).toBe("reports.visits");
  });

  it("tabel.marks → year/month", () => {
    const built = planFromQuestion("tabel marks shu oy");
    expect(built.intent).toBe("tabel.marks");
    expect(built.plan.calls[0]?.tool).toBe("tabel.marks");
  });

  it("stock.transfer → period", () => {
    const built = planFromQuestion("ombor transfer shu oy");
    expect(built.intent).toBe("stock.transfer");
    expect(built.plan.calls[0]?.tool).toBe("stock.transfer");
  });
});

describe("planFromQuestion — new write plans", () => {
  it("write.order_status → order_id + status", () => {
    const built = planFromQuestion("buyurtma #100 holatini tasdiqlandi qil");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.order_status");
    const params = built.plan.calls[0]?.params;
    expect(params.order_id).toBe(100);
    expect(params.status).toBe("tasdiqlandi");
  });

  it("write.order_status → missing order_id", () => {
    const built = planFromQuestion("buyurtma holatini tasdiqlandi qil");
    expect(built.write).toBe(true);
    expect(built.plan.missing.length).toBeGreaterThan(0);
  });

  it("write.update_product → product search", () => {
    const built = planFromQuestion("mahsulotni yangila SKU-001 nom Olma");
    expect(built.write).toBe(true);
    expect(built.intent).toBe("write.update_product");
  });
});

describe("READ_TOOLS_EXTRA catalog", () => {
  it("9 ta qo'shimcha o'qish tool bor", () => {
    expect(READ_TOOLS_EXTRA.length).toBe(9);
  });

  it("har birida to'g'ri path bor", () => {
    const paths = READ_TOOLS_EXTRA.map((t) => t.path({}));
    expect(paths).toEqual(expect.arrayContaining([
      expect.stringContaining("/orders/"),
      expect.stringContaining("/reports/expeditor-returns/orders/"),
      expect.stringContaining("/consignment/agents"),
      expect.stringContaining("/reports/visits-2"),
      expect.stringContaining("/tabel/marks"),
      expect.stringContaining("/reports/agent-kpi"),
      expect.stringContaining("/price-matrix/lookup"),
      expect.stringContaining("/orders/consignment-transfers"),
      expect.stringContaining("/orders/prices-as-of")
    ]));
  });

  it("har birida anyOf permission bor", () => {
    for (const tool of READ_TOOLS_EXTRA) {
      expect(Array.isArray(tool.anyOf)).toBe(true);
      expect(tool.anyOf.length).toBeGreaterThan(0);
    }
  });
});

describe("WRITE_TOOLS catalog", () => {
  it("10 ta yozish tool bor", () => {
    expect(WRITE_TOOLS.length).toBe(10);
  });

  it("write.order_status mavjud", () => {
    const tool = WRITE_TOOLS.find((t) => t.id === "write.order_status");
    expect(tool).toBeDefined();
    expect(tool?.method).toBe("PATCH");
    expect(tool?.anyOf).toContain("orders.zakaz.update");
  });

  it("har bir write tool'da preview bor", () => {
    for (const tool of WRITE_TOOLS) {
      expect(typeof tool.preview).toBe("function");
    }
  });
});
