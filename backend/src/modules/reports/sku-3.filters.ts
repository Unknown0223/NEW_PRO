import { prisma } from "../../config/database";
import {
  priceTypeEntriesFromUnknown,
  priceTypeKey
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";

export async function getSku3FilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};

  const priceEntries = priceTypeEntriesFromUnknown(refs.price_type_entries).filter(
    (e) => e.active !== false && e.kind === "sale"
  );
  const price_types = priceEntries
    .map((e) => {
      const id = priceTypeKey(e).trim();
      return { id, label: e.name.trim() || id };
    })
    .filter((x) => x.id)
    .reduce<Array<{ id: string; label: string }>>((acc, cur) => {
      if (!acc.some((x) => x.id === cur.id)) acc.push(cur);
      return acc;
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const [agents, expeditors, products, clientCats, territoryRowsRaw] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "agent"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "expeditor"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sku: true },
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
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    expeditors: expeditors.map((e) => ({ id: e.id, name: e.name, code: e.code ?? "" })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
    price_types,
    client_categories: clientCats.map((r) => r.v),
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3
  };
}
