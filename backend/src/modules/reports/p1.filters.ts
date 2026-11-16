import { prisma } from "../../config/database";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope
} from "../access/access-filter-options-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";

export async function getP1FilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ??
        {}
      : {};

  const [tradeDirections, brands, products, territoryRowsRaw] = await Promise.all([
    prisma.tradeDirection.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { sort_order: "asc" }
    }),
    prisma.productBrand.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, sku: true, brand_id: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
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
          territory_nodes: pruneTerritoryNodesByTerms(
            parseTerritoryNodes(refs.territory_nodes),
            scope.territoryTerms
          )
        };
  const territoryOpts = mergeTerritoryFilterOptions(refsForTerritory, territoryRows);

  const dielux = tradeDirections.find(
    (d) => d.code?.toUpperCase() === "DIELUX" || d.name.trim().toUpperCase() === "DIELUX"
  );

  return {
    date_types: [
      { id: "order_date", label: "Дата заказа" },
      { id: "shipped_date", label: "Дата отправки" },
      { id: "delivered_date", label: "Дата доставки" }
    ],
    default_date_type: "order_date" as const,
    default_trade_direction_id: dielux?.id ?? null,
    trade_directions: tradeDirections.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code ?? ""
    })),
    brands: brands.map((b) => ({ id: b.id, name: b.name, code: b.code ?? "" })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand_id: p.brand_id
    })),
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_2_by_1: territoryOpts.territory_2_by_1,
    territory_tree: territoryOpts.territory_tree
  };
}
