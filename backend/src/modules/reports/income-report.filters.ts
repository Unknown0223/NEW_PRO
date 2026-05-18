import { prisma } from "../../config/database";
import { mergeTerritoryFilterOptions } from "./territory-nodes";

export async function getIncomeReportFilterOptions(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};

  const [agents, expeditors, cashDesks, categories, paymentTypes, tradeDirections, territoryRows] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: { in: ["agent", "Agent", "AGENT"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: { in: ["expeditor", "Expeditor", "EXPEDITOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.cashDesk.findMany({ where: { tenant_id: tenantId, is_active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { tenant_id: tenantId, category: { not: null } }, select: { category: true }, distinct: ["category"] }),
    prisma.payment.findMany({
      where: { tenant_id: tenantId, deleted_at: null, entry_kind: "payment", workflow_status: "confirmed" },
      select: { payment_type: true },
      distinct: ["payment_type"]
    }),
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        trade_direction: { not: null },
        role: { in: ["agent", "Agent", "AGENT"] }
      },
      select: { trade_direction: true },
      distinct: ["trade_direction"]
    }),
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `
  ]);
  const territoryOpts = mergeTerritoryFilterOptions(refs, territoryRows);
  return {
    agents,
    expeditors,
    cashDesks,
    categories: categories.map((x) => x.category).filter((x): x is string => Boolean(x)).sort(),
    paymentTypes: paymentTypes.map((x) => x.payment_type).filter(Boolean).sort(),
    tradeDirections: tradeDirections.map((x) => x.trade_direction).filter((x): x is string => Boolean(x)).sort(),
    territories1: territoryOpts.territory_1,
    territories2: territoryOpts.territory_2,
    territories3: territoryOpts.territory_3,
    territory2By1: territoryOpts.territory_2_by_1,
    territory3By2: territoryOpts.territory_3_by_2,
    citiesByZoneRegion: territoryOpts.cities_by_zone_region,
    territory3By12: territoryOpts.cities_by_zone_region
  };
}
