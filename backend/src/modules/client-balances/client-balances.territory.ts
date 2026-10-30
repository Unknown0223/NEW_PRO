import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import { loadActiveBranchNames } from "../tenant-settings/tenant-settings.refs";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import type { ClientBalanceTerritoryOptions } from "./client-balances.types";
import { buildClientWhere } from "./client-balances.where";
import type { ClientBalanceListQuery } from "./client-balances.types";
import { inferCityTerritoryFromCode } from "../mobile/mobile-territory-references";

export async function listClientBalanceTerritoryOptions(
  tenantId: number,
  scope?: ClientBalanceListQuery
): Promise<ClientBalanceTerritoryOptions> {
  const clientScopeWhere: Prisma.ClientWhereInput = scope
    ? await buildClientWhere(tenantId, scope, { skipBalanceFilter: true, skipTerritoryFilters: true })
    : { tenant_id: tenantId, merged_into_client_id: null };

  const withField = (field: Prisma.ClientWhereInput): Prisma.ClientWhereInput => ({
    AND: [clientScopeWhere, field]
  });

  const [regions, cities, districts, zones, neighborhoods, branchNames] = await Promise.all([
    prisma.client.findMany({
      where: withField({ region: { not: null } }),
      select: { region: true },
      distinct: ["region"],
      orderBy: { region: "asc" }
    }),
    prisma.client.findMany({
      where: withField({ city: { not: null } }),
      select: { city: true },
      distinct: ["city"],
      orderBy: { city: "asc" }
    }),
    prisma.client.findMany({
      where: withField({ district: { not: null } }),
      select: { district: true },
      distinct: ["district"],
      orderBy: { district: "asc" }
    }),
    prisma.client.findMany({
      where: withField({ zone: { not: null } }),
      select: { zone: true },
      distinct: ["zone"],
      orderBy: { zone: "asc" }
    }),
    prisma.client.findMany({
      where: withField({ neighborhood: { not: null } }),
      select: { neighborhood: true },
      distinct: ["neighborhood"],
      orderBy: { neighborhood: "asc" }
    }),
    loadActiveBranchNames(tenantId)
  ]);

  const inferredRegions = new Set<string>();
  const inferredZones = new Set<string>();
  for (const row of cities) {
    const inf = inferCityTerritoryFromCode(row.city ?? "");
    if (!inf) continue;
    inferredRegions.add(inf.region);
    inferredZones.add(inf.zone);
  }

  const uniqSorted = (values: string[]) =>
    [...new Set(values.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    regions: uniqSorted([...regions.map((r) => r.region!), ...inferredRegions]),
    cities: cities.map((r) => r.city!).filter((x) => x.trim() !== ""),
    districts: districts.map((r) => r.district!).filter((x) => x.trim() !== ""),
    zones: uniqSorted([...zones.map((r) => r.zone!), ...inferredZones]),
    neighborhoods: neighborhoods.map((r) => r.neighborhood!).filter((x) => x.trim() !== ""),
    branches: branchNames
  };
}
