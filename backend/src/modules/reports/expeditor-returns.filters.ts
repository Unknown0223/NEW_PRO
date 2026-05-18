import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import { KNOWN_ORDER_TYPES, ORDER_STATUS_LABEL_RU, orderTypeLabelRu } from "./expeditor-returns.helpers";

export async function getExpeditorReturnsFilterOptions(tenantId: number, actor?: ReportActor) {
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
  const paymentMethodsFromSettings = paymentEntries
    .filter((e) => e.active !== false)
    .map((e) => ({ id: paymentMethodStorageKey(e), label: e.name.trim() }))
    .filter((x) => x.id && x.label);
  const paymentMethodMap = new Map<string, { id: string; label: string }>();
  for (const item of paymentMethodsFromSettings) {
    if (!paymentMethodMap.has(item.id)) paymentMethodMap.set(item.id, item);
  }
  const payment_methods = [...paymentMethodMap.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const [agents, expeditors, categories, territoryRows] = await Promise.all([
    prisma.user.findMany({
      where: whereAgent,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "expeditor", is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `
  ]);
  const territoryOpts = mergeTerritoryFilterOptions(refs, territoryRows);

  return {
    date_types: [
      { id: "order_date", label: "Дата заказа" },
      { id: "created_date", label: "Дата создания" },
      { id: "shipped_date", label: "Дата отправки" }
    ],
    application_types: [
      { id: "all", label: "Все заказы" },
      { id: "returns_only", label: "Заказы с возвратами" }
    ],
    unit_modes: [
      { id: "qty", label: "По количеству" },
      { id: "pack", label: "По упаковке" },
      { id: "volume", label: "По объему" },
      { id: "weight", label: "По весу" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: ORDER_STATUS_LABEL_RU[s] ?? s })),
    order_types: KNOWN_ORDER_TYPES.map((s) => ({ id: s, label: orderTypeLabelRu(s) })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    expeditors: expeditors.map((e) => ({ id: e.id, name: e.name, code: e.code ?? "" })),
    categories,
    payment_methods,
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3,
    territory_2_by_1: territoryOpts.territory_2_by_1,
    territory_3_by_2: territoryOpts.territory_3_by_2,
    territory_tree: territoryOpts.territory_tree,
    regions_by_zone: territoryOpts.regions_by_zone,
    cities_by_zone_region: territoryOpts.cities_by_zone_region
  };
}
