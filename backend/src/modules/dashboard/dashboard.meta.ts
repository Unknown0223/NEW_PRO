import { getRedisForApp } from "../../lib/redis-cache";
import { prisma } from "../../config/database";
import { buildScopedAgentWhereForActor } from "../access/access-agent-scope";
import { getClientReferences } from "../clients/clients.references";
import {
  listProductBrands,
  listProductCatalogGroups,
  listProductManufacturers
} from "../products/product-catalog.service";
import { getProductSalesReportFilterOptions } from "../reports/product-sales.filters";
import type { ReportActor } from "../reports/client-sales-4-report.service";
import { listProductCategoriesForTenant } from "../reference/reference.category.list";
import { listStaff } from "../staff/staff.crud.list";
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

function mapStaff(rows: Awaited<ReturnType<typeof listStaff>>) {
  return rows.map((r) => ({
    id: r.id,
    fio: r.fio,
    code: r.code ?? null
  }));
}

export async function getDashboardMeta(
  tenantId: number,
  actor?: ReportActor
): Promise<DashboardMetaPayload> {
  const cacheKey = `tenant:${tenantId}:dashboard:meta:v2:${actor?.role ?? "none"}:${actor?.userId ?? 0}`;
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DashboardMetaPayload;
  } catch {
    /* ignore */
  }

  const whereAgent = await buildScopedAgentWhereForActor(tenantId, actor);

  const [
    scopedAgents,
    supervisors,
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
      where: whereAgent,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    listStaff(tenantId, "supervisor", { is_active: true }),
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
  const result: DashboardMetaPayload = {
    agents: scopedAgents.map((a) => ({
      id: a.id,
      fio: a.name,
      code: a.code ?? null
    })),
    supervisors: mapStaff(supervisors),
    client_references,
    product_categories: product_categories_raw.map((c) => ({ id: c.id, name: c.name })),
    profile_refs: {
      payment_method_entries: refs.payment_method_entries as DashboardMetaPayload["profile_refs"]["payment_method_entries"],
      payment_types: refs.payment_types as string[] | undefined,
      trade_directions: refs.trade_directions as string[] | undefined,
      territory_nodes: refs.territory_nodes as unknown[] | undefined
    },
    product_sales_filter_options,
    territories: territoryPage.data.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code ?? null
    })),
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
