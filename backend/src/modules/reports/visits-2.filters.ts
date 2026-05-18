import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import { WEEKDAY_LABEL_RU } from "./visits-2.constants";

export async function getVisits2FilterOptions(tenantId: number, actor?: ReportActor) {
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
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};

  const [agents, territoryRows, clientCats, productCats] = await Promise.all([
    prisma.user.findMany({
      where: whereAgent,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT c.category AS v
      FROM clients c
      WHERE c.tenant_id = ${tenantId} AND c.category IS NOT NULL AND c.category <> ''
      ORDER BY c.category
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT c.product_category_ref AS v
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
        AND c.product_category_ref IS NOT NULL
        AND c.product_category_ref <> ''
      ORDER BY c.product_category_ref
    `
  ]);

  const territoryOpts = mergeTerritoryFilterOptions(refs, territoryRows);

  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
    id,
    label: WEEKDAY_LABEL_RU[id] ?? String(id)
  }));

  return {
    agents: agents.map((a) => ({ id: a.id, name: a.name, code: a.code ?? "" })),
    client_categories: clientCats.map((x) => x.v),
    product_categories: productCats.map((x) => x.v),
    weekdays,
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

