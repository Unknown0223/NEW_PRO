import { describe, expect, it } from "vitest";
import { parseInventoryQuery } from "../src/modules/reports/inventory.parse";

describe("inventory-report parseInventoryQuery", () => {
  it("defaults date_type to order_date and client_active to all", () => {
    const f = parseInventoryQuery({});
    expect(f.date_type).toBe("order_date");
    expect(f.client_active).toBe("all");
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.inventory_types).toEqual([]);
    expect(f.agent_ids).toEqual([]);
  });

  it("parses shipped_date, active clients, and multi filters", () => {
    const f = parseInventoryQuery({
      date_type: "shipped_date",
      client_active: "active",
      from: "2026-01-01",
      to: "2026-01-31",
      inventory_types: "Холодильник,Стелаж",
      agent_ids: "2,9",
      supervisor_ids: "4",
      category_ids: "1,3",
      statuses: "new,delivered",
      payment_methods: "Naxt,Terminal",
      client_categories: "A,B",
      territory_3_list: "Andijon",
      search: "  shop  ",
      page: "2",
      limit: "100"
    });
    expect(f.date_type).toBe("shipped_date");
    expect(f.client_active).toBe("active");
    expect(f.from).toBe("2026-01-01");
    expect(f.to).toBe("2026-01-31");
    expect(f.inventory_types).toEqual(["Холодильник", "Стелаж"]);
    expect(f.agent_ids).toEqual([2, 9]);
    expect(f.supervisor_ids).toEqual([4]);
    expect(f.category_ids).toEqual([1, 3]);
    expect(f.statuses).toEqual(["new", "delivered"]);
    expect(f.payment_methods).toEqual(["Naxt", "Terminal"]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_3_list).toEqual(["Andijon"]);
    expect(f.search).toBe("shop");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(100);
  });

  it("rejects unknown date_type and client_active to defaults", () => {
    const f = parseInventoryQuery({ date_type: "bogus", client_active: "maybe" });
    expect(f.date_type).toBe("order_date");
    expect(f.client_active).toBe("all");
  });
});
