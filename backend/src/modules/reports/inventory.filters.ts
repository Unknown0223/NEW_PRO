import { prisma } from "../../config/database";
import { ORDER_STATUSES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";
import { ORDER_STATUS_LABEL_RU } from "./expeditor-returns.helpers";

export async function getInventoryFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const currencyEntries = resolveCurrencyEntries(refs);
  const paymentEntries = resolvePaymentMethodEntries(refs, currencyEntries);
  const payment_methods = [
    ...new Map(
      paymentEntries
        .filter((e) => e.active !== false)
        .map((e) => {
          const id = paymentMethodStorageKey(e);
          return [id, { id, label: e.name.trim() }] as const;
        })
        .filter(([id, x]) => id && x.label)
    ).values()
  ].sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const [agents, supervisors, categories, inventoryTypes, clientCats, territoryRowsRaw] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "agent"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "supervisor"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT ce.inventory_type AS v
      FROM client_equipment ce
      WHERE ce.tenant_id = ${tenantId}
        AND ce.removed_at IS NULL
        AND ce.inventory_type <> ''
      ORDER BY ce.inventory_type
    `,
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
    `
  ]);

  const territoryRows = filterTerritoryRowsByTerms(territoryRowsRaw, scope.territoryTerms);
  const refsForTerritory =
    scope.territoryTerms === null
      ? refs
      : {
          ...refs,
          territory_nodes: pruneTerritoryNodesByTerms(parseTerritoryNodes(refs.territory_nodes), scope.territoryTerms)
        };
  const territoryOpts = mergeTerritoryFilterOptions(refsForTerritory, territoryRows);

  return {
    date_types: [
      { id: "order_date", label: "Дата заявки" },
      { id: "shipped_date", label: "Дата отгрузки" }
    ],
    client_active: [
      { id: "all", label: "Все клиенты" },
      { id: "active", label: "Активные клиенты" },
      { id: "inactive", label: "Неактивные клиенты" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: ORDER_STATUS_LABEL_RU[s] ?? s })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    supervisors: supervisors.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    categories,
    inventory_types: inventoryTypes.map((r) => r.v),
    payment_methods,
    client_categories: clientCats.map((r) => r.v),
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3
  };
}
