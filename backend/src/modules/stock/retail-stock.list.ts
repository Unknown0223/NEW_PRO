import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


import type { RetailStockCategoryRow, RetailStockDetailedRow, RetailStockListQuery, RetailStockListResult } from "./retail-stock.types";
import { buildWhere, clampLimit, clampPage, toDecimal } from "./retail-stock.helpers";

export async function listRetailStock(
  tenantId: number,
  raw: RetailStockListQuery
): Promise<RetailStockListResult> {
  const page = clampPage(raw.page);
  const limit = clampLimit(raw.limit);
  const skip = (page - 1) * limit;
  const where = buildWhere(tenantId, raw);

  const allForKpi = await prisma.retailOutletStock.findMany({
    where,
    select: { client_id: true, quantity: true, sold_quantity: true }
  });
  const allClients = new Set(allForKpi.map((r) => r.client_id)).size;
  const clientsWithProduct = new Set(
    allForKpi.filter((r) => toDecimal(r.quantity).gt(0)).map((r) => r.client_id)
  ).size;
  const qtyTotal = allForKpi.reduce((a, r) => a.plus(r.quantity), new Prisma.Decimal(0));
  const soldTotal = allForKpi.reduce((a, r) => a.plus(r.sold_quantity), new Prisma.Decimal(0));
  const basePresenceRate =
    allClients > 0
      ? new Prisma.Decimal(clientsWithProduct).mul(100).div(new Prisma.Decimal(allClients))
      : new Prisma.Decimal(0);
  const salesCoefficient = qtyTotal.gt(0) ? soldTotal.div(qtyTotal) : new Prisma.Decimal(0);

  if (raw.view === "categories") {
    const rows = await prisma.retailOutletStock.findMany({
      where,
      include: {
        product: { select: { category_id: true, category: { select: { id: true, name: true } } } }
      },
      orderBy: [{ stock_date: "desc" }, { id: "desc" }]
    });
    const grouped = new Map<string, RetailStockCategoryRow>();
    const clientsByKey = new Map<string, Set<number>>();
    for (const r of rows) {
      const date = r.stock_date.toISOString().slice(0, 10);
      const cid = r.product.category_id ?? 0;
      const cName = r.product.category?.name ?? "Без категории";
      const key = `${date}::${cid}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          stock_date: date,
          category_id: r.product.category_id,
          category_name: cName,
          quantity: "0",
          sold_quantity: "0",
          amount: "0",
          coverage_clients: 0
        });
        clientsByKey.set(key, new Set<number>());
      }
      const g = grouped.get(key)!;
      g.quantity = toDecimal(g.quantity).plus(r.quantity).toString();
      g.sold_quantity = toDecimal(g.sold_quantity).plus(r.sold_quantity).toString();
      g.amount = toDecimal(g.amount).plus(r.amount ?? 0).toString();
      if (toDecimal(r.quantity).gt(0)) clientsByKey.get(key)!.add(r.client_id);
    }
    for (const [k, set] of clientsByKey) {
      const g = grouped.get(k);
      if (g) g.coverage_clients = set.size;
    }
    const arr = [...grouped.values()].sort((a, b) => {
      if (a.stock_date !== b.stock_date) return a.stock_date < b.stock_date ? 1 : -1;
      return a.category_name.localeCompare(b.category_name, "ru");
    });
    return {
      view: "categories",
      page,
      limit,
      total: arr.length,
      kpi: {
        base_presence_rate: basePresenceRate.toFixed(2),
        sales_coefficient: salesCoefficient.toFixed(4)
      },
      data: arr.slice(skip, skip + limit)
    };
  }

  const [total, rows] = await Promise.all([
    prisma.retailOutletStock.count({ where }),
    prisma.retailOutletStock.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, region: true, zone: true, city: true } },
        product: { select: { id: true, name: true, sku: true, category: { select: { id: true, name: true } } } }
      },
      orderBy: [{ stock_date: "desc" }, { id: "desc" }],
      skip,
      take: limit
    })
  ]);

  return {
    view: "products",
    page,
    limit,
    total,
    kpi: {
      base_presence_rate: basePresenceRate.toFixed(2),
      sales_coefficient: salesCoefficient.toFixed(4)
    },
    data: rows.map((r) => ({
      stock_date: r.stock_date.toISOString().slice(0, 10),
      client_id: r.client_id,
      client_name: r.client.name,
      territory: [r.territory_1 ?? r.client.region, r.territory_2 ?? r.client.zone, r.territory_3 ?? r.client.city]
        .filter(Boolean)
        .join(" / "),
      agent_id: r.agent_id,
      agent_name: r.agent_id ? `Agent #${r.agent_id}` : null,
      category_id: r.product.category?.id ?? null,
      category_name: r.product.category?.name ?? null,
      product_id: r.product_id,
      product_name: r.product.name,
      sku: r.product.sku,
      quantity: r.quantity.toString(),
      sold_quantity: r.sold_quantity.toString(),
      volume: r.volume,
      amount: (r.amount ?? new Prisma.Decimal(0)).toString(),
      price_type: r.price_type,
      comment: r.comment
    }))
  };
}

