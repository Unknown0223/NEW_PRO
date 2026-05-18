import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { getRedisForApp } from "../../lib/redis-cache";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import { KNOWN_ORDER_TYPES, ORDER_STATUS_LABEL_RU, orderTypeLabelRu } from "./product-sales.helpers";

export async function getProductSalesReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const cacheKey = `tenant:${tenantId}:reports:product-sales:filter-options:v1:${actor?.role ?? "none"}:${actor?.userId ?? 0}`;
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    /* ignore */
  }

  const whereAgent: Prisma.UserWhereInput =
    actor?.role === "agent" && actor.userId
      ? { tenant_id: tenantId, id: actor.userId, is_active: true }
      : actor?.role === "supervisor" && actor.userId
        ? { tenant_id: tenantId, role: "agent", supervisor_user_id: actor.userId, is_active: true }
        : { tenant_id: tenantId, role: "agent", is_active: true };

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
  const settingsPriceTypeEntries = priceTypeEntriesFromUnknown(refs.price_type_entries)
    .filter((entry) => entry.active !== false && entry.kind === "sale");
  const price_types = [
    ...new Set(settingsPriceTypeEntries.map((entry) => priceTypeKey(entry).trim()).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, "ru"));

  const paymentMethodsFromSettings = paymentEntries
    .filter((e) => e.active !== false)
    .map((e) => ({ id: paymentMethodStorageKey(e), label: e.name.trim() }))
    .filter((x) => x.id && x.label);
  const paymentMethodMap = new Map<string, { id: string; label: string }>();
  for (const item of paymentMethodsFromSettings) {
    if (!paymentMethodMap.has(item.id)) paymentMethodMap.set(item.id, item);
  }
  const payment_methods = [...paymentMethodMap.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const [
    agents,
    categories,
    groups,
    segments,
    brands,
    products,
    warehouses,
    supervisors,
    tradeDirections,
    paymentTypesDistinct
  ] = await Promise.all([
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
      prisma.productBrand.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" }
      }),
      prisma.product.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, name: true, sku: true },
        orderBy: { name: "asc" },
        take: 2500
      }),
      prisma.warehouse.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" }
      }),
      prisma.user.findMany({
        where: { tenant_id: tenantId, role: "supervisor", is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" }
      }),
      prisma.tradeDirection.findMany({
        where: { tenant_id: tenantId, is_active: true },
        select: { id: true, name: true, code: true },
        orderBy: { sort_order: "asc" }
      }),
      prisma.$queryRaw<Array<{ v: string }>>`
        SELECT DISTINCT btrim(pay.payment_type) AS v
        FROM client_payments pay
        WHERE pay.tenant_id = ${tenantId}
          AND pay.deleted_at IS NULL
          AND pay.entry_kind = 'payment'
          AND pay.workflow_status = 'confirmed'
          AND pay.order_id IS NOT NULL
          AND btrim(pay.payment_type) <> ''
        ORDER BY btrim(pay.payment_type)
      `
    ]);

  const territoryRows = await prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
    SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
    FROM clients c
    WHERE c.tenant_id = ${tenantId}
  `;
  const territoryOpts = mergeTerritoryFilterOptions(refs, territoryRows);

  const payment_type_columns = paymentTypesDistinct.map((r) => {
    const key = (r.v ?? "").trim();
    return { key, label: resolvePaymentMethodRefToLabel(key, paymentEntries) ?? key };
  });

  const result = {
    date_types: [
      { id: "order_date", label: "Дата заказа" },
      { id: "shipped_date", label: "Дата отправки" },
      { id: "delivered_date", label: "Дата доставки" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: ORDER_STATUS_LABEL_RU[s] ?? s })),
    order_types: KNOWN_ORDER_TYPES.map((s) => ({ id: s, label: orderTypeLabelRu(s) })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    supervisors: supervisors.map((s) => ({ id: s.id, name: s.name, code: s.code ?? "" })),
    categories,
    product_groups: groups,
    segments,
    brands: brands.map((b) => ({ id: b.id, name: b.name, code: b.code ?? "" })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code ?? "" })),
    trade_directions: tradeDirections.map((d) => ({ id: d.id, name: d.name, code: d.code ?? "" })),
    price_types,
    payment_methods,
    payment_type_columns,
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3,
    territory_2_by_1: territoryOpts.territory_2_by_1,
    territory_3_by_2: territoryOpts.territory_3_by_2,
    territory_tree: territoryOpts.territory_tree,
    regions_by_zone: territoryOpts.regions_by_zone,
    cities_by_zone_region: territoryOpts.cities_by_zone_region
  };
  try {
    const redis = await getRedisForApp();
    await redis.set(cacheKey, JSON.stringify(result), "EX", 300);
  } catch {
    /* ignore */
  }
  return result;
}
