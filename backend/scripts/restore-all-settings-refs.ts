/**
 * test1 settings.references to‘liq tiklash:
 * - territory_nodes: Lalaku zona/viloyat + territories jadvalidan shaharlar
 * - currency, unit_measures, branches, feature_flags, territory_levels, payment_types
 * - trade directions aktivlash
 *
 *   cd backend
 *   $env:IMPORT_TENANT_SLUG='test1'
 *   npx tsx scripts/restore-all-settings-refs.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  mergeTerritoryBundle,
  normKeyTerritoryMatch,
  type LalakuTerritoryNode
} from "../../shared/territory-lalaku-seed.ts";
import { DEFAULT_TERRITORY_LEVELS } from "./lib/territory-codes-enrich.ts";
import {
  paymentTypeStorageKeysFromMethodEntries,
  type CurrencyEntryDto
} from "../src/modules/tenant-settings/finance-refs.ts";
import {
  buildAccessTerritorySyncPayload,
  invalidateAccessTerritorySyncCache,
  syncTerritoriesFromPayload
} from "../src/modules/access/access-territories-sync.ts";
import { invalidateTenantSettingsCache } from "../src/lib/redis-cache.ts";
import { territoryRegionPickerNames } from "../src/modules/tenant-settings/tenant-settings.service.ts";

const prisma = new PrismaClient();

/** Excel/gorod shahar kodi prefiksi → viloyat nomi (Lalaku). */
const CITY_PREFIX_TO_REGION: Record<string, string> = {
  AD: "ANDIJON VILOYATI",
  FR: "FARGONA VILOYATI",
  NM: "NAMANGAN VILOYATI",
  BX: "BUXORO VILOYATI",
  JZ: "JIZZAX VILOYATI",
  NV: "NAVOIY VILOYATI",
  QS: "QASHQADARYO VILOYATI",
  SR: "SURXANDARYO VILOYATI",
  XR: "XORAZM VILOYATI",
  NK: "QORAQALPOQISTON",
  QQ: "QOQON",
  QO: "QOQON",
  TV: "TOSHKENT VILOYATI",
  TSH: "TOSHKENT SHAHAR",
  SM: "SAMARQAND VILOYATI",
  SD: "SIRDARYO VILOYATI"
};

const DEFAULT_UNITS = ["dona", "kg", "litr", "m", "m2", "m3", "quti", "paket"] as const;

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, unknown>) };
  return {};
}

function countNodes(nodes: LalakuTerritoryNode[]): number {
  let n = 0;
  for (const x of nodes) {
    n += 1;
    n += countNodes(x.children ?? []);
  }
  return n;
}

function collectCodes(nodes: LalakuTerritoryNode[], into: Set<string>) {
  for (const n of nodes) {
    const c = (n.code ?? "").trim().toUpperCase();
    if (c) into.add(c);
    if (n.children?.length) collectCodes(n.children, into);
  }
}

function findRegionNode(forest: LalakuTerritoryNode[], regionName: string): LalakuTerritoryNode | null {
  const want = normKeyTerritoryMatch(regionName);
  for (const z of forest) {
    for (const r of z.children ?? []) {
      if (normKeyTerritoryMatch(r.name) === want) return r;
    }
  }
  return null;
}

function sanitizeCode(raw: string | null | undefined): string | null {
  const up = (raw ?? "").trim().toUpperCase();
  if (!up || !/^[A-Z0-9_]+$/.test(up)) return null;
  return up.slice(0, 20);
}

function cityPrefix(code: string): string | null {
  const c = code.toUpperCase();
  if (c.includes("_")) {
    const p = c.split("_")[0]!;
    if (CITY_PREFIX_TO_REGION[p]) return p;
  }
  // TSH, TV, …
  for (const p of Object.keys(CITY_PREFIX_TO_REGION).sort((a, b) => b.length - a.length)) {
    if (c.startsWith(p) && (c.length === p.length || c[p.length] === "_")) return p;
  }
  return null;
}

function rebuildForestFromTerritoriesTable(
  base: LalakuTerritoryNode[],
  rows: { code: string | null; name: string }[]
): LalakuTerritoryNode[] {
  const forest = mergeTerritoryBundle(base);
  const usedCodes = new Set<string>();
  collectCodes(forest, usedCodes);

  let attached = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row.name.trim();
    const code = sanitizeCode(row.code);
    if (!name) continue;

    // Skip zone/region labels already in forest
    if (/VILOYATI|SHAHAR|SHAXAR|^FV$|^SOUTH-WEST$|^TASH/i.test(name) && !code?.includes("_")) {
      skipped++;
      continue;
    }
    if (code && usedCodes.has(code)) {
      skipped++;
      continue;
    }

    const pref = code ? cityPrefix(code) : null;
    const regionName = pref ? CITY_PREFIX_TO_REGION[pref] : null;
    const region = regionName ? findRegionNode(forest, regionName) : null;
    if (!region) {
      skipped++;
      continue;
    }

    const nodeCode = code ?? sanitizeCode(`${pref ?? "C"}_${name.replace(/[^a-zA-Z0-9]+/g, "_")}`) ?? `C_${randomUUID().slice(0, 8).toUpperCase()}`;
    if (usedCodes.has(nodeCode)) {
      skipped++;
      continue;
    }
    usedCodes.add(nodeCode);
    region.children = region.children ?? [];
    // avoid duplicate city names under same region
    if (region.children.some((c) => normKeyTerritoryMatch(c.name) === normKeyTerritoryMatch(name))) {
      skipped++;
      continue;
    }
    region.children.push({
      id: `city-${nodeCode.toLowerCase()}`,
      name,
      code: nodeCode,
      comment: null,
      sort_order: region.children.length + 1,
      active: true,
      children: []
    });
    attached++;
  }

  // sort city children
  for (const z of forest) {
    for (const r of z.children ?? []) {
      r.children = [...(r.children ?? [])].sort((a, b) => a.name.localeCompare(b.name, "uz"));
    }
  }

  console.log(`territory rebuild: attached=${attached} skipped=${skipped} total=${countNodes(forest)}`);
  return forest;
}

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`tenant ${slug} not found`);

  const st = asRecord(tenant.settings);
  const ref = asRecord(st.references);

  const territoryRows = await prisma.territory.findMany({
    where: { tenant_id: tenant.id, deleted_at: null },
    select: { code: true, name: true },
    orderBy: { id: "asc" }
  });

  const forest = rebuildForestFromTerritoriesTable([], territoryRows);

  // Units from products + defaults
  const productUnits = await prisma.product.findMany({
    where: { tenant_id: tenant.id },
    select: { unit: true },
    distinct: ["unit"]
  });
  const unitNames = [
    ...new Set([
      ...DEFAULT_UNITS,
      ...productUnits.map((p) => (p.unit ?? "").trim()).filter(Boolean)
    ])
  ];
  const unit_measures = unitNames.map((name, i) => ({
    id: `unit-${name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40) || i}`,
    name,
    title: name,
    code: name
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "")
      .slice(0, 20) || `U${i}`,
    sort_order: i + 1,
    comment: null,
    active: true
  }));

  const currency_entries: CurrencyEntryDto[] = [
    {
      id: "default-uzs",
      name: "So'm",
      code: "UZS",
      sort_order: 1,
      active: true,
      is_default: true
    }
  ];

  const payment_method_entries = Array.isArray(ref.payment_method_entries)
    ? ref.payment_method_entries
    : [];
  const price_type_entries = Array.isArray(ref.price_type_entries) ? ref.price_type_entries : [];

  // Default branch if empty — link first cash desk if any
  let branches = Array.isArray(ref.branches) ? [...(ref.branches as any[])] : [];
  if (branches.length === 0) {
    const cash = await prisma.cashDesk.findFirst({
      where: { tenant_id: tenant.id },
      select: { id: true, name: true }
    });
    branches = [
      {
        id: "branch-main",
        name: "Asosiy filial",
        code: "MAIN",
        sort_order: 1,
        comment: null,
        active: true,
        cash_desk_id: cash?.id ?? null
      }
    ];
  }

  const nextRef: Record<string, unknown> = {
    ...ref,
    territory_nodes: forest,
    territory_levels: [...DEFAULT_TERRITORY_LEVELS],
    territory_tree: [],
    regions: territoryRegionPickerNames({ territory_nodes: forest }),
    client_zones: Array.isArray(ref.client_zones) && (ref.client_zones as any[]).length
      ? ref.client_zones
      : ["FV", "SOUTH-WEST", "TASH OBL", "TASHKENT"],
    client_cities: Array.isArray(ref.client_cities) ? ref.client_cities : [],
    currency_entries,
    unit_measures,
    branches,
    payment_method_entries,
    price_type_entries,
    payment_types:
      payment_method_entries.length > 0
        ? paymentTypeStorageKeysFromMethodEntries(payment_method_entries as any)
        : Array.isArray(ref.payment_types)
          ? ref.payment_types
          : []
  };

  const nextSettings = {
    ...st,
    feature_flags: {
      orders_sse: true,
      ...asRecord(st.feature_flags)
    },
    return_filter: st.return_filter ?? {
      period_enabled: false,
      period_unit: "day",
      period_value: 30,
      balance_zero_enabled: false
    },
    references: nextRef
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: nextSettings as Prisma.InputJsonValue }
  });

  // Reactivate Lalaku trade directions
  await prisma.tradeDirection.updateMany({
    where: {
      tenant_id: tenant.id,
      code: { in: ["DIELUX", "GIGA", "LALAKU", "REVEREM", "UMUMIY"] }
    },
    data: { is_active: true }
  });

  const payload = buildAccessTerritorySyncPayload(nextSettings);
  invalidateAccessTerritorySyncCache(tenant.id);
  await syncTerritoriesFromPayload(tenant.id, payload);
  await invalidateTenantSettingsCache(tenant.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        territory_roots: forest.length,
        territory_total: countNodes(forest),
        unit_measures: unit_measures.length,
        branches: branches.length,
        currency_entries: currency_entries.length,
        synced_territory_items: payload?.items.length ?? 0
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
