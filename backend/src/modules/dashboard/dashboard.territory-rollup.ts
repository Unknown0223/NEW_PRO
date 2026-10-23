import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { normKeyTerritoryMatch, REGION_ZONE_ROWS } from "../../../shared/territory-lalaku-seed";
import { isLikelyRegionName } from "../mobile/mobile-territory-references";
import { territoryNodesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import {
  buildCityTerritoryHints,
  referencesWithResolvedTerritoryNodes,
  territoryNodeStoredValue
} from "../tenant-settings/tenant-settings.territory";
import type { TerritoryNodeDto } from "../tenant-settings/tenant-settings.types";
import { clampPct } from "./dashboard.helpers";

type Index = {
  regionCanon: Map<string, string>;
  parentOf: Map<string, string>;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function rememberRegion(index: Index, raw: string) {
  const name = raw.trim();
  if (!name) return;
  const key = normKeyTerritoryMatch(name);
  if (!key || index.regionCanon.has(key)) return;
  const known = REGION_ZONE_ROWS.find((row) => normKeyTerritoryMatch(row.region) === key);
  index.regionCanon.set(key, known?.region ?? name);
}

function rememberPlace(index: Index, place: string, region: string) {
  const placeKey = normKeyTerritoryMatch(place);
  const regionName = region.trim();
  if (!placeKey || !regionName || index.regionCanon.has(placeKey)) return;
  if (!index.parentOf.has(placeKey)) index.parentOf.set(placeKey, index.regionCanon.get(normKeyTerritoryMatch(regionName)) ?? regionName);
}

function walkNodes(list: TerritoryNodeDto[], ancestors: string[], index: Index) {
  for (const node of list) {
    if (node.active === false) continue;
    const name = (node.name ?? "").trim();
    const stored = territoryNodeStoredValue(node);
    if (name && (isLikelyRegionName(name) || index.regionCanon.has(normKeyTerritoryMatch(name)))) {
      rememberRegion(index, name);
    }
    const regionAncestor = [...ancestors].reverse().find((a) => index.regionCanon.has(normKeyTerritoryMatch(a)) || isLikelyRegionName(a));
    if (regionAncestor) {
      if (name) rememberPlace(index, name, regionAncestor);
      if (stored) rememberPlace(index, stored, regionAncestor);
    }
    if (node.children?.length) walkNodes(node.children, name ? [...ancestors, name] : ancestors, index);
  }
}

export async function loadTerritoryRegionIndex(tenantId: number): Promise<Index> {
  const index: Index = { regionCanon: new Map(), parentOf: new Map() };
  for (const row of REGION_ZONE_ROWS) rememberRegion(index, row.region);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const ref = referencesWithResolvedTerritoryNodes(asRecord(asRecord(tenant?.settings).references));
  const hints = buildCityTerritoryHints(ref);
  for (const hint of Object.values(hints)) {
    const region = (hint.region_label || hint.region_stored || "").trim();
    if (!region) continue;
    rememberRegion(index, region);
    if (hint.city_label) rememberPlace(index, hint.city_label, region);
    if (hint.region_stored) rememberRegion(index, hint.region_stored);
    if (hint.district_label) rememberPlace(index, hint.district_label, region);
    if (hint.district_stored) rememberPlace(index, hint.district_stored, region);
  }
  walkNodes(territoryNodesFromUnknown(ref.territory_nodes), [], index);

  const pairs = await prisma.$queryRaw<Array<{ place: string; region: string; n: number }>>`
    SELECT place, region, n FROM (
      SELECT btrim(city) AS place, btrim(region) AS region, COUNT(*)::int AS n
      FROM clients
      WHERE tenant_id = ${tenantId}
        AND btrim(COALESCE(city, '')) <> ''
        AND btrim(COALESCE(region, '')) <> ''
      GROUP BY 1, 2
      UNION ALL
      SELECT btrim(district) AS place, btrim(region) AS region, COUNT(*)::int AS n
      FROM clients
      WHERE tenant_id = ${tenantId}
        AND btrim(COALESCE(district, '')) <> ''
        AND btrim(COALESCE(region, '')) <> ''
      GROUP BY 1, 2
    ) s
    ORDER BY n DESC
  `;
  for (const row of pairs) {
    if (!isLikelyRegionName(row.region) && !index.regionCanon.has(normKeyTerritoryMatch(row.region))) continue;
    rememberRegion(index, row.region);
    rememberPlace(index, row.place, row.region);
  }
  return index;
}

export function resolveTerritoryLabel(raw: string, index: Index): string {
  const name = raw.trim();
  if (!name || name === "—" || name === "-") return name || "—";
  const key = normKeyTerritoryMatch(name);
  const region = index.regionCanon.get(key);
  if (region) return region;
  return index.parentOf.get(key) ?? name;
}

export function rollupSalesTerritoryRows<
  T extends { territory: string; sales_sum: string; akb: number; okb: number; coverage_pct: number }
>(rows: T[], index: Index): T[] {
  const by = new Map<string, T>();
  for (const row of rows) {
    const territory = resolveTerritoryLabel(row.territory, index);
    const prev = by.get(territory);
    if (!prev) {
      by.set(territory, { ...row, territory });
      continue;
    }
    const akb = prev.akb + row.akb;
    const okb = prev.okb + row.okb;
    const sales = new Prisma.Decimal(prev.sales_sum).add(row.sales_sum);
    by.set(territory, {
      ...prev,
      territory,
      sales_sum: sales.toString(),
      akb,
      okb,
      coverage_pct: okb > 0 ? clampPct((akb / okb) * 100) : 0
    });
  }
  return [...by.values()].sort((a, b) => Number(b.sales_sum) - Number(a.sales_sum));
}

export function rollupDebtTerritoryRows<T extends { territory: string; debt_sum: string; debtors_count: number }>(
  rows: T[],
  index: Index
): T[] {
  const by = new Map<string, T>();
  for (const row of rows) {
    const territory = resolveTerritoryLabel(row.territory, index);
    const prev = by.get(territory);
    if (!prev) {
      by.set(territory, { ...row, territory });
      continue;
    }
    by.set(territory, {
      ...prev,
      territory,
      debt_sum: new Prisma.Decimal(prev.debt_sum).add(row.debt_sum).toString(),
      debtors_count: prev.debtors_count + row.debtors_count
    });
  }
  return [...by.values()].sort((a, b) => Number(b.debt_sum) - Number(a.debt_sum));
}
