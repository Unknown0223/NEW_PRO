import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/config/database", () => ({
  prisma: {
    warehouse: { findMany: vi.fn() }
  }
}));

import { prisma } from "../src/config/database";
import { fetchWarehouseIdsForBalances } from "../src/modules/stock/stock.balances.helpers";

describe("fetchWarehouseIdsForBalances actor scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("without scope returns all purpose warehouses", async () => {
    vi.mocked(prisma.warehouse.findMany).mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
    const ids = await fetchWarehouseIdsForBalances(10, {
      purpose: "sales",
      active_only: true,
      q: "",
      qty_mode: "all",
      allowed_warehouse_ids: null
    });
    expect(ids).toEqual([1, 2]);
    expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
      where: { tenant_id: 10, is_active: true, stock_purpose: "sales" },
      select: { id: true }
    });
  });

  it("with scope intersects to allowed warehouses on All", async () => {
    vi.mocked(prisma.warehouse.findMany).mockResolvedValue([{ id: 5 }] as never);
    const ids = await fetchWarehouseIdsForBalances(10, {
      purpose: "sales",
      active_only: true,
      q: "",
      qty_mode: "all",
      allowed_warehouse_ids: [5, 9]
    });
    expect(ids).toEqual([5]);
    expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
      where: {
        tenant_id: 10,
        is_active: true,
        stock_purpose: "sales",
        id: { in: [5, 9] }
      },
      select: { id: true }
    });
  });

  it("rejects warehouse_id outside allowed scope", async () => {
    const ids = await fetchWarehouseIdsForBalances(10, {
      purpose: "sales",
      warehouse_id: 99,
      active_only: true,
      q: "",
      qty_mode: "all",
      allowed_warehouse_ids: [5]
    });
    expect(ids).toEqual([]);
    expect(prisma.warehouse.findMany).not.toHaveBeenCalled();
  });

  it("empty allowed list returns no warehouses", async () => {
    const ids = await fetchWarehouseIdsForBalances(10, {
      purpose: "sales",
      active_only: true,
      q: "",
      qty_mode: "all",
      allowed_warehouse_ids: []
    });
    expect(ids).toEqual([]);
  });
});
