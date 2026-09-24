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
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";
import type { ReportActor } from "./client-sales-2.types";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";

export async function getClientSales2FilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const profilePriceTypeEntries = priceTypeEntriesFromUnknown(refs.price_type_entries).filter((x) => x.active !== false);

  const [agents, categories, products, groups, segments] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "agent"),
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

  const [clientCats, territoryRowsRaw, orderTypes] = await Promise.all([
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

  const territoryRows = filterTerritoryRowsByTerms(territoryRowsRaw, scope.territoryTerms);
  const refsForTerritory =
    scope.territoryTerms === null
      ? refs
      : {
          ...refs,
          territory_nodes: pruneTerritoryNodesByTerms(
            parseTerritoryNodes(refs.territory_nodes),
            scope.territoryTerms
          )
        };
  const territoryOpts = mergeTerritoryFilterOptions(refsForTerritory, territoryRows);

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
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3,
    territory_tree: territoryOpts.territory_tree,
    regions_by_zone: territoryOpts.regions_by_zone,
    cities_by_zone_region: territoryOpts.cities_by_zone_region
  };
}

