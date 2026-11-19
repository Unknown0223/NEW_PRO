import { prisma } from "../../config/database";
import { ORDER_STATUSES } from "../orders/order-status";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";
import { ORDER_STATUS_LABEL_RU } from "./expeditor-returns.helpers";

export async function getCumulativeBonusFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};

  const [agents, rules, clientCats, territoryRowsRaw] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "agent"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.bonusRule.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, is_active: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
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
      { id: "created_at", label: "Дата заявки" },
      { id: "shipped_date", label: "Дата отгрузки" }
    ],
    group_by: [
      { id: "client", label: "По клиентам" },
      { id: "agent", label: "По агентам" },
      { id: "rule", label: "По бонус-правилам" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: ORDER_STATUS_LABEL_RU[s] ?? s })),
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    bonus_rules: rules.map((r) => ({ id: r.id, name: r.name, active: r.is_active })),
    client_categories: clientCats.map((r) => r.v),
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3
  };
}
