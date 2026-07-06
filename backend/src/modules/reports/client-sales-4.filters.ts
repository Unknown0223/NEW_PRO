import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildScopedAgentWhereForActor } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4.types";
import { KNOWN_ORDER_TYPES } from "./client-sales-4.helpers";

export async function getClientSales4FilterOptions(tenantId: number, actor?: ReportActor) {
  const whereAgent = await buildScopedAgentWhereForActor(tenantId, actor);

  const [agents, categories, brands, tradeDirections, territoryRows, orderTypes, clientCats] =
    await Promise.all([
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
      prisma.productBrand.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" }
      }),
      prisma.tradeDirection.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { sort_order: "asc" }
      }),
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
      `,
      prisma.$queryRaw<Array<{ v: string }>>`
        SELECT DISTINCT c.category AS v
        FROM clients c
        WHERE c.tenant_id = ${tenantId} AND c.category IS NOT NULL AND c.category <> ''
        ORDER BY c.category
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

  const statuses = [
    { id: "new", label: "Новый" },
    { id: "confirmed", label: "Подтвержден" },
    { id: "delivering", label: "Отгружен" },
    { id: "delivered", label: "Доставлен" },
    { id: "cancelled", label: "Отменен" },
    { id: "returned", label: "Возврат" },
    { id: "return_processing", label: "В процессе возврата" }
  ];

  const orderTypeLabel = (id: string) => {
    if (id === "order") return "Заказ";
    if (id === "return") return "Возврат с полки";
    if (id === "exchange") return "Обмен";
    if (id === "return_by_order") return "Возврат по заказу";
    if (id === "partial_return") return "Частичный возврат";
    return id;
  };

  const orderTypeIdsFromDb = orderTypes.map((x) => String(x.v).trim()).filter(Boolean);
  const orderTypeIds = [...new Set([...KNOWN_ORDER_TYPES, ...orderTypeIdsFromDb])].sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  return {
    statuses,
    order_types: orderTypeIds.map((id) => ({ id, label: orderTypeLabel(id) })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    categories,
    brands: brands.map((b) => ({ id: b.id, name: b.name, code: b.code ?? "" })),
    trade_directions: tradeDirections.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code ?? ""
    })),
    client_categories: clientCats.map((x) => x.v),
    territory_1: [...new Set(territoryRows.map((x) => (x.t1 ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru")
    ),
    territory_2: [...new Set(territoryRows.map((x) => (x.t2 ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru")
    ),
    territory_3: [...new Set(territoryRows.map((x) => (x.t3 ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ru")
    ),
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
