import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { AgentOrdersFilters, TerritoryNode } from "./agent-orders.types";
import { buildTerritoryIndexFromNodes, parseTerritoryNodes } from "./agent-orders.helpers";

export async function getAgentOrdersFilterOptions(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const currencyEntries = resolveCurrencyEntries(refs);
  const paymentEntries = resolvePaymentMethodEntries(refs, currencyEntries);

  const [agents, categories, products, groups, segments, tradeDirections] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "agent", is_active: true },
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
      take: 1000
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
    }),
    prisma.tradeDirection.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { code: true, name: true },
      orderBy: { sort_order: "asc" }
    })
  ]);

  const [clientCats, paymentMethodRefs, territories, orderTypeRows] = await Promise.all([
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT c.category AS v
      FROM clients c
      WHERE c.tenant_id = ${tenantId} AND c.category IS NOT NULL AND c.category <> ''
      ORDER BY c.category
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT btrim(o.payment_method_ref) AS v
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.payment_method_ref IS NOT NULL
        AND btrim(o.payment_method_ref) <> ''
      ORDER BY btrim(o.payment_method_ref)
    `,
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT o.order_type AS v
      FROM orders o
      WHERE o.tenant_id = ${tenantId} AND o.order_type IS NOT NULL AND o.order_type <> ''
      ORDER BY o.order_type
    `
  ]);

  const t1 = [...new Set(territories.map((x) => (x.t1 ?? "").trim()).filter(Boolean))].sort();
  const t2 = [...new Set(territories.map((x) => (x.t2 ?? "").trim()).filter(Boolean))].sort();
  const t3 = [...new Set(territories.map((x) => (x.t3 ?? "").trim()).filter(Boolean))].sort();
  const territoryNodes = parseTerritoryNodes(refs.territory_nodes);
  const territoryFromSettings = buildTerritoryIndexFromNodes(territoryNodes);
  const territory2By1FromData = new Map<string, Set<string>>();
  const territory3By2FromData = new Map<string, Set<string>>();
  for (const row of territories) {
    const zone = (row.t1 ?? "").trim();
    const region = (row.t2 ?? "").trim();
    const city = (row.t3 ?? "").trim();
    if (zone && region) {
      const set = territory2By1FromData.get(zone) ?? new Set<string>();
      set.add(region);
      territory2By1FromData.set(zone, set);
    }
    if (region && city) {
      const set = territory3By2FromData.get(region) ?? new Set<string>();
      set.add(city);
      territory3By2FromData.set(region, set);
    }
  }
  const territory_2_by_1 =
    Object.keys(territoryFromSettings.territory_2_by_1).length > 0
      ? territoryFromSettings.territory_2_by_1
      : (Object.fromEntries(
          [...territory2By1FromData.entries()].map(([zone, set]) => [zone, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
        ) as Record<string, string[]>);
  const territory_3_by_2 =
    Object.keys(territoryFromSettings.territory_3_by_2).length > 0
      ? territoryFromSettings.territory_3_by_2
      : (Object.fromEntries(
          [...territory3By2FromData.entries()].map(([region, set]) => [region, [...set].sort((a, b) => a.localeCompare(b, "ru"))])
        ) as Record<string, string[]>);
  const paymentMethodsFromSettings = paymentEntries
    .filter((e) => e.active !== false)
    .map((e) => ({ id: paymentMethodStorageKey(e), label: e.name.trim() }))
    .filter((x) => x.id && x.label);
  const paymentMethodsFromData = paymentMethodRefs.flatMap((x) =>
    String(x.v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((token) => ({ id: token, label: resolvePaymentMethodRefToLabel(token, paymentEntries) ?? token }))
  );
  const paymentMethodMap = new Map<string, { id: string; label: string }>();
  for (const item of [...paymentMethodsFromSettings, ...paymentMethodsFromData]) {
    if (!paymentMethodMap.has(item.id)) paymentMethodMap.set(item.id, item);
  }
  const paymentMethods = [...paymentMethodMap.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const orderTypeSet = new Set<string>([...ORDER_TYPES, ...orderTypeRows.map((x) => x.v).filter(Boolean)]);

  const settingsPriceTypeEntries = priceTypeEntriesFromUnknown(refs.price_type_entries)
    .filter((entry) => entry.active !== false && entry.kind === "sale");
  const normalizedPriceTypes = [...new Set(settingsPriceTypeEntries.map((entry) => priceTypeKey(entry).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  return {
    date_types: [
      { id: "order_date", label: "По дате заказа" },
      { id: "shipped_date", label: "По дате отправки" },
      { id: "delivered_date", label: "По дате доставки" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: s })),
    order_types: [...orderTypeSet].map((s) => ({ id: s, label: s })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    categories,
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    groups,
    segments,
    trade_directions: tradeDirections.map((d) => ({ id: d.code || d.name, name: d.name })),
    client_categories: clientCats.map((x) => x.v),
    price_types: normalizedPriceTypes,
    payment_methods: paymentMethods,
    territory_1: territoryFromSettings.territory_1.length > 0 ? territoryFromSettings.territory_1 : t1,
    territory_2: territoryFromSettings.territory_2.length > 0 ? territoryFromSettings.territory_2 : t2,
    territory_3: territoryFromSettings.territory_3.length > 0 ? territoryFromSettings.territory_3 : t3,
    territory_2_by_1,
    territory_3_by_2
  };
}

