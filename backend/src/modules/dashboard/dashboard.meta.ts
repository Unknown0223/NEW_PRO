import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import {
  filterStringListByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";
import { getClientReferences } from "../clients/clients.references";
import {
  listProductBrands,
  listProductCatalogGroups,
  listProductManufacturers
} from "../products/product-catalog.service";
import { getProductSalesReportFilterOptions } from "../reports/product-sales.filters";
import type { ReportActor } from "../reports/client-sales-4-report.service";
import { parseTerritoryNodes } from "../reports/territory-nodes";
import { listProductCategoriesForTenant } from "../reference/reference.category.list";
import { listTerritories } from "../territory/territory.crud";
import { getTenantProfile } from "../tenant-settings/tenant-settings.profile.read";

const META_CACHE_TTL = 300;

export type DashboardMetaPayload = {
  agents: Array<{ id: number; fio: string; code: string | null }>;
  supervisors: Array<{ id: number; fio: string; code: string | null }>;
  client_references: Awaited<ReturnType<typeof getClientReferences>>;
  product_categories: Array<{ id: number; name: string }>;
  profile_refs: {
    payment_method_entries?: Array<{ id: string; name: string; active?: boolean; code?: string | null }>;
    price_type_entries?: Array<{
      id: string;
      name: string;
      code?: string | null;
      payment_method_id?: string;
      active?: boolean;
    }>;
    payment_types?: string[];
    trade_directions?: string[];
    territory_nodes?: unknown[];
  };
  product_sales_filter_options: Awaited<ReturnType<typeof getProductSalesReportFilterOptions>>;
  territories: Array<{ id: number; name: string; code: string | null }>;
  catalog_brands: Array<{ id: number; name: string }>;
  catalog_groups: Array<{ id: number; name: string }>;
  catalog_manufacturers: Array<{ id: number; name: string }>;
};

export async function getDashboardMeta(
  tenantId: number,
  actor?: ReportActor
): Promise<DashboardMetaPayload> {
  const cacheKey = `tenant:${tenantId}:dashboard:meta:v8:${actor?.role ?? "none"}:${actor?.userId ?? 0}`;
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DashboardMetaPayload;
  } catch {
    /* ignore */
  }

  const scope = await resolveFilterOptionsScope(tenantId, actor);

  const [
    scopedAgents,
    supervisors,
    selfSupervisorRow,
    client_references,
    product_categories_raw,
    profile,
    product_sales_filter_options,
    territoryPage,
    brandsPage,
    groupsPage,
    manufacturersPage
  ] = await Promise.all([
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
    actor?.userId && actor.role === "supervisor"
      ? prisma.user.findFirst({
          where: { id: actor.userId, tenant_id: tenantId, role: "supervisor" },
          select: { id: true, name: true, code: true }
        })
      : Promise.resolve(null),
    getClientReferences(tenantId),
    listProductCategoriesForTenant(tenantId),
    getTenantProfile(tenantId),
    getProductSalesReportFilterOptions(tenantId, actor),
    listTerritories(tenantId, { page: 1, limit: 300 }),
    listProductBrands(tenantId, { page: 1, limit: 200 }),
    listProductCatalogGroups(tenantId, { page: 1, limit: 200 }),
    listProductManufacturers(tenantId, { page: 1, limit: 200 })
  ]);

  const refs = profile.references ?? {};
  const territory_nodes = pruneTerritoryNodesByTerms(
    parseTerritoryNodes(refs.territory_nodes),
    scope.territoryTerms
  );
  const zonesFromNodes = territory_nodes.map((n) => n.name.trim()).filter(Boolean);
  const regionsFromNodes: string[] = [];
  const citiesFromNodes: string[] = [];
  for (const z of territory_nodes) {
    for (const r of z.children ?? []) {
      const rn = r.name?.trim();
      if (rn) regionsFromNodes.push(rn);
      for (const c of r.children ?? []) {
        const cn = c.name?.trim();
        if (cn) citiesFromNodes.push(cn);
      }
    }
  }

  const boundTerritoryIds = new Set(scope.actor.territory_ids ?? []);
  let scopedTerritories: DashboardMetaPayload["territories"];
  if (scope.unrestricted) {
    scopedTerritories = territoryPage.data.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code ?? null
    }));
  } else if (boundTerritoryIds.size > 0) {
    scopedTerritories = territoryPage.data
      .filter((t) => boundTerritoryIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, code: t.code ?? null }));
  } else if ((scope.territoryTerms?.length ?? 0) > 0) {
    const terms = scope.territoryTerms ?? [];
    scopedTerritories = territoryPage.data
      .filter((t) => {
        const hay = `${t.name ?? ""} ${t.code ?? ""}`.toLowerCase();
        return terms.some((term) => hay.includes(term.toLowerCase()));
      })
      .map((t) => ({ id: t.id, name: t.name, code: t.code ?? null }));
  } else {
    scopedTerritories = [];
  }

  const supervisorById = new Map<number, { id: number; name: string; code: string | null }>();
  for (const s of supervisors) supervisorById.set(s.id, s);
  if (selfSupervisorRow) supervisorById.set(selfSupervisorRow.id, selfSupervisorRow);

  const result: DashboardMetaPayload = {
    agents: scopedAgents.map((a) => ({
      id: a.id,
      fio: a.name,
      code: a.code ?? null
    })),
    supervisors: [...supervisorById.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((s) => ({
        id: s.id,
        fio: s.name,
        code: s.code ?? null
      })),
    client_references: scope.unrestricted
      ? client_references
      : {
          ...client_references,
          // Pruned settings daraxti ustuvor — FV/SOUTH-WEST flat match sizib chiqmasin
          zones:
            zonesFromNodes.length > 0
              ? [...new Set(zonesFromNodes)].sort((a, b) => a.localeCompare(b, "ru"))
              : filterStringListByTerms(client_references.zones ?? [], scope.territoryTerms),
          regions:
            regionsFromNodes.length > 0
              ? [...new Set(regionsFromNodes)].sort((a, b) => a.localeCompare(b, "ru"))
              : filterStringListByTerms(client_references.regions ?? [], scope.territoryTerms),
          cities:
            citiesFromNodes.length > 0
              ? [...new Set(citiesFromNodes)].sort((a, b) => a.localeCompare(b, "ru"))
              : filterStringListByTerms(client_references.cities ?? [], scope.territoryTerms)
        },
    product_categories: product_categories_raw.map((c) => ({ id: c.id, name: c.name })),
    profile_refs: {
      payment_method_entries: refs.payment_method_entries as DashboardMetaPayload["profile_refs"]["payment_method_entries"],
      price_type_entries: refs.price_type_entries as DashboardMetaPayload["profile_refs"]["price_type_entries"],
      payment_types: refs.payment_types as string[] | undefined,
      trade_directions: refs.trade_directions as string[] | undefined,
      territory_nodes
    },
    product_sales_filter_options,
    territories: scopedTerritories,
    catalog_brands: brandsPage.data.map((b) => ({ id: b.id, name: b.name })),
    catalog_groups: groupsPage.data.map((g) => ({ id: g.id, name: g.name })),
    catalog_manufacturers: manufacturersPage.data.map((m) => ({ id: m.id, name: m.name }))
  };

  try {
    const redis = await getRedisForApp();
    await redis.set(cacheKey, JSON.stringify(result), "EX", META_CACHE_TTL);
  } catch {
    /* ignore */
  }

  return result;
}
