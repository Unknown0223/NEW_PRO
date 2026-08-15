import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { WarehouseTableRow } from "./reference.warehouse.types";

export async function listWarehousesTable(
  tenantId: number,
  opts: { is_active?: boolean; q?: string; page: number; limit: number; archive?: boolean }
): Promise<{ data: WarehouseTableRow[]; total: number; page: number; limit: number }> {
  const where: Prisma.WarehouseWhereInput = { tenant_id: tenantId };
  if (opts.archive) {
    where.is_active = false;
  } else if (opts.is_active !== undefined) {
    where.is_active = opts.is_active;
  } else {
    where.is_active = true;
  }
  const q = (opts.q ?? "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { type: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { payment_method: { contains: q, mode: "insensitive" } }
    ];
  }
  const skip = (opts.page - 1) * opts.limit;
  const [total, rows] = await Promise.all([
    prisma.warehouse.count({ where }),
    prisma.warehouse.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip,
      take: opts.limit,
      select: {
        id: true,
        name: true,
        type: true,
        stock_purpose: true,
        code: true,
        address: true,
        payment_method: true,
        van_selling: true,
        is_active: true
      }
    })
  ]);

  const ids = rows.map((r) => r.id);
  const statsByWh = new Map<number, Map<string, number>>();
  for (const wid of ids) statsByWh.set(wid, new Map());

  if (ids.length > 0) {
    const grouped = await prisma.warehouseUserLink.groupBy({
      by: ["warehouse_id", "link_role"],
      where: { warehouse_id: { in: ids } },
      _count: { _all: true }
    });
    for (const g of grouped) {
      const m = statsByWh.get(g.warehouse_id);
      if (m) m.set(g.link_role, g._count._all);
    }
  }

  const data: WarehouseTableRow[] = rows.map((row) => {
    const roleMap = statsByWh.get(row.id)!;
    const breakdown = [...roleMap.entries()]
      .map(([role, count]) => ({ role, count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));
    const user_total = breakdown.reduce((s, x) => s + x.count, 0);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      stock_purpose: row.stock_purpose,
      code: row.code,
      address: row.address,
      payment_method: row.payment_method,
      van_selling: row.van_selling,
      is_active: row.is_active,
      breakdown,
      user_total
    };
  });

  return { data, total, page: opts.page, limit: opts.limit };
}
