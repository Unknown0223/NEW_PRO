import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ReportActor } from "./client-sales-2.types";
import { buildScopedAgentWhereForActor } from "../access/access-agent-scope";

export async function getClientSales2FilterOptions(tenantId: number, actor?: ReportActor) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const profilePriceTypeEntries = priceTypeEntriesFromUnknown(refs.price_type_entries).filter((x) => x.active !== false);

  const whereAgent = await buildScopedAgentWhereForActor(tenantId, actor);

  const [agents, categories, products, groups, segments] = await Promise.all([
    prisma.user.findMany({
      where: whereAgent,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
      take: 1500
    }),
    prisma.productCatalogGroup.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.productSegment.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const [clientCats, territoryRows, orderTypes] = await Promise.all([
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT c.category AS v
      FROM clients c
      WHERE c.tenant_id = ${tenantId} AND c.category IS NOT NULL AND c.category <> ''
      ORDER BY c.category
    `,
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT o.order_type AS v
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type IS NOT NULL
        AND o.order_type <> ''
      ORDER BY o.order_type
    `
  ]);

  const zoneRegionMap = new Map<string, Set<string>>();
  const zoneRegionCityMap = new Map<string, Set<string>>();
  for (const row of territoryRows) {
    const z = (row.t1 ?? "").trim();
    const r = (row.t2 ?? "").trim();
    const c = (row.t3 ?? "").trim();
    if (!z) continue;
    if (!zoneRegionMap.has(z)) zoneRegionMap.set(z, new Set<string>());
    if (r) zoneRegionMap.get(z)!.add(r);
    if (r) {
      const zr = `${z}|||${r}`;
      if (!zoneRegionCityMap.has(zr)) zoneRegionCityMap.set(zr, new Set<string>());
      if (c) zoneRegionCityMap.get(zr)!.add(c);
    }
  }

  const priceTypeOptions = profilePriceTypeEntries
    .map((x) => ({ id: priceTypeKey(x), label: x.name.trim() || priceTypeKey(x) }))
    .filter((x) => x.id)
    .reduce<Array<{ id: string; label: string }>>((acc, cur) => {
      if (!acc.some((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  return {
    date_types: [
      { id: "order_date", label: "Дата заказа" },
      { id: "shipped_date", label: "Дата отправки" },
      { id: "delivered_date", label: "Дата доставки" },
      { id: "created_date", label: "Дата создания" }
    ],
    statuses: [
      { id: "new", label: "Новый" },
      { id: "confirmed", label: "Подтвержден" },
      { id: "delivering", label: "Отгружен" },
      { id: "delivered", label: "Доставлен" },
      { id: "cancelled", label: "Отменен" },
      { id: "returned", label: "Возврат" },
      { id: "return_processing", label: "В процессе возврата" }
    ],
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    categories,
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    groups,
    segments,
    day_visit_options: [
      { id: 1, label: "Пн" },
      { id: 2, label: "Вт" },
      { id: 3, label: "Ср" },
      { id: 4, label: "Чт" },
      { id: 5, label: "Пт" },
      { id: 6, label: "Сб" },
      { id: 7, label: "Вс" }
    ],
    price_types: priceTypeOptions.map((x) => x.id),
    price_type_options: priceTypeOptions,
    order_types: orderTypes.map((x) => x.v),
    client_categories: clientCats.map((x) => x.v),
    territory_1: [...new Set(territoryRows.map((x) => (x.t1 ?? "").trim()).filter(Boolean))].sort(),
    territory_2: [...new Set(territoryRows.map((x) => (x.t2 ?? "").trim()).filter(Boolean))].sort(),
    territory_3: [...new Set(territoryRows.map((x) => (x.t3 ?? "").trim()).filter(Boolean))].sort(),
    territory_tree: territoryRows.map((x) => ({
      zone: (x.t1 ?? "").trim(),
      region: (x.t2 ?? "").trim(),
      city: (x.t3 ?? "").trim()
    })),
    regions_by_zone: Object.fromEntries(
      [...zoneRegionMap.entries()].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, "ru"))])
    ),
    cities_by_zone_region: Object.fromEntries(
      [...zoneRegionCityMap.entries()].map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, "ru"))])
    )
  };
}

