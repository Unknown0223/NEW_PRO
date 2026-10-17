import { prisma } from "../../config/database";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { activeBranchNamesFromReferences } from "../tenant-settings/tenant-settings.refs";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import {
  activePresetLabels,
  resolveWebStaffPresetsFromSettings
} from "./staff.patches.web-presets.store";
import { SKLADCHIK_WAREHOUSE_LINK_ROLE } from "./staff.shared.types";

async function listStaffPositionPresetLabels(tenantId: number, settings: unknown): Promise<string[]> {
  const presets = await resolveWebStaffPresetsFromSettings(tenantId, settings);
  return activePresetLabels(presets);
}

export async function listAgentFilterOptions(tenantId: number): Promise<{
  branches: string[];
  trade_directions: string[];
  positions: string[];
  /** Agent `User.territory` to‘liq qiymatlari (zona / uchastok tanlash) */
  territories: string[];
  /** Viloyat, shahar va boshqa tokenlar (`territory` qatorida qidiruv) */
  territory_tokens: string[];
  territory_oblasts: string[];
  territory_cities: string[];
}> {
  const [rows, dbTrade, tenantRow, cr, cc, cd, cz, cn, territoryOpts] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "agent" },
      select: { territory: true }
    }),
    listActiveTradeDirectionLabels(tenantId),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, region: { not: null } },
      distinct: ["region"],
      select: { region: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, city: { not: null } },
      distinct: ["city"],
      select: { city: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, district: { not: null } },
      distinct: ["district"],
      select: { district: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, zone: { not: null } },
      distinct: ["zone"],
      select: { zone: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, neighborhood: { not: null } },
      distinct: ["neighborhood"],
      select: { neighborhood: true }
    }),
    collectTerritoryOblastCityOptions(tenantId)
  ]);
  const branches = new Set<string>();
  const trade_directions = new Set<string>();
  const positions = new Set<string>();
  const territories = new Set<string>();
  const territory_tokens = new Set<string>();

  const st = tenantRow?.settings;
  const refObj = (st as { references?: Record<string, unknown> } | null | undefined)?.references;

  for (const name of activeBranchNamesFromReferences(refObj)) branches.add(name);
  for (const label of await listStaffPositionPresetLabels(tenantId, st)) positions.add(label);

  const pushAgentTerritoryToken = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (t.length < 2) return;
    territory_tokens.add(t);
    for (const part of t.split(/[,;\n|/]+/)) {
      const p = part.trim();
      if (p.length >= 2) territory_tokens.add(p);
    }
  };

  for (const r of rows) {
    if (r.territory?.trim()) {
      const full = r.territory.trim();
      territories.add(full);
      pushAgentTerritoryToken(full);
    }
  }

  for (const s of territoryRegionPickerNames(refObj)) pushAgentTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_cities")) pushAgentTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_districts")) pushAgentTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_zones")) pushAgentTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_neighborhoods")) pushAgentTerritoryToken(s);

  for (const r of cr) pushAgentTerritoryToken(r.region);
  for (const r of cc) pushAgentTerritoryToken(r.city);
  for (const r of cd) pushAgentTerritoryToken(r.district);
  for (const r of cz) pushAgentTerritoryToken(r.zone);
  for (const r of cn) pushAgentTerritoryToken(r.neighborhood);

  for (const v of dbTrade) trade_directions.add(v);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    branches: [...branches].sort(sort),
    trade_directions: [...trade_directions].sort(sort),
    positions: [...positions].sort(sort),
    territories: [...territories].sort(sort),
    territory_tokens: [...territory_tokens].sort(sort),
    territory_oblasts: territoryOpts.territory_oblasts,
    territory_cities: territoryOpts.territory_cities
  };
}
export async function listSupervisorFilterOptions(tenantId: number): Promise<{ positions: string[] }> {
  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const positions = await listStaffPositionPresetLabels(tenantId, tenantRow?.settings);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return { positions: [...positions].sort(sort) };
}

export async function listCollectorFilterOptions(tenantId: number): Promise<{
  positions: string[];
  territories: string[];
  territory_oblasts: string[];
  territory_cities: string[];
}> {
  const [rows, tenantRow, territoryOpts] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "collector" },
      select: { territory: true }
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    collectTerritoryOblastCityOptions(tenantId)
  ]);
  const positions = await listStaffPositionPresetLabels(tenantId, tenantRow?.settings);
  const territories = new Set<string>();
  for (const r of rows) {
    if (r.territory?.trim()) territories.add(r.territory.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    positions: [...positions].sort(sort),
    territories: [...territories].sort(sort),
    territory_oblasts: territoryOpts.territory_oblasts,
    territory_cities: territoryOpts.territory_cities
  };
}

export async function listAuditorFilterOptions(tenantId: number): Promise<{
  positions: string[];
  territories: string[];
  territory_oblasts: string[];
  territory_cities: string[];
}> {
  const [rows, tenantRow, territoryOpts] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "auditor" },
      select: { territory: true }
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    collectTerritoryOblastCityOptions(tenantId)
  ]);
  const positions = await listStaffPositionPresetLabels(tenantId, tenantRow?.settings);
  const territories = new Set<string>();
  for (const r of rows) {
    if (r.territory?.trim()) territories.add(r.territory.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    positions: [...positions].sort(sort),
    territories: [...territories].sort(sort),
    territory_oblasts: territoryOpts.territory_oblasts,
    territory_cities: territoryOpts.territory_cities
  };
}

export async function listSkladchikFilterOptions(tenantId: number): Promise<{
  branches: string[];
  positions: string[];
  position_presets: string[];
  warehouses: Array<{ id: number; name: string; branches: string[] }>;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true }
  });
  const presetRows =
    tenant != null ? await resolveWebStaffPresetsFromSettings(tenant.id, tenant.settings) : [];
  const presetLabelActive = activePresetLabels(presetRows);
  const ref = asRecord(asRecord(tenant?.settings).references);
  const branches = activeBranchNamesFromReferences(ref);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");

  const [users, allWh] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "skladchik" },
      select: {
        branch: true,
        warehouse_id: true,
        warehouse: { select: { id: true, name: true, is_active: true } },
        warehouse_links: {
          where: { link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE },
          select: {
            warehouse: { select: { id: true, name: true, is_active: true } }
          }
        }
      }
    }),
    prisma.warehouse.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const byId = new Map<number, { id: number; name: string; branches: Set<string> }>();
  for (const w of allWh) {
    byId.set(w.id, { id: w.id, name: w.name, branches: new Set() });
  }

  const attach = (wh: { id: number; name: string; is_active: boolean } | null | undefined, branch: string | null) => {
    if (!wh || !wh.is_active) return;
    let row = byId.get(wh.id);
    if (!row) {
      row = { id: wh.id, name: wh.name, branches: new Set() };
      byId.set(wh.id, row);
    }
    const b = (branch ?? "").trim();
    if (b) row.branches.add(b);
  };

  for (const u of users) {
    attach(u.warehouse, u.branch);
    for (const link of u.warehouse_links) attach(link.warehouse, u.branch);
  }

  const warehouses = [...byId.values()]
    .map((w) => ({
      id: w.id,
      name: w.name,
      branches: [...w.branches].sort(sort)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return {
    branches,
    positions: [...presetLabelActive].sort(sort),
    position_presets: presetLabelActive,
    warehouses
  };
}

/** Client/refs dan oblast + shahar ro‘yxatlari (eksportor/agent/collector/auditor filtrlari). */
async function collectTerritoryOblastCityOptions(tenantId: number): Promise<{
  territory_oblasts: string[];
  territory_cities: string[];
}> {
  const [tenantRow, cr, cc] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, region: { not: null } },
      distinct: ["region"],
      select: { region: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, city: { not: null } },
      distinct: ["city"],
      select: { city: true }
    })
  ]);
  const st = tenantRow?.settings;
  const refObj = (st as { references?: Record<string, unknown> } | null | undefined)?.references;
  const territory_oblasts = new Set<string>();
  const territory_cities = new Set<string>();
  const push = (set: Set<string>, raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (t.length >= 2) set.add(t);
  };
  for (const s of territoryRegionPickerNames(refObj)) push(territory_oblasts, s);
  for (const s of refStringListFromTenantSettings(st, "client_cities")) push(territory_cities, s);
  for (const r of cr) push(territory_oblasts, r.region);
  for (const r of cc) push(territory_cities, r.city);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    territory_oblasts: [...territory_oblasts].sort(sort),
    territory_cities: [...territory_cities].sort(sort)
  };
}

export function refStringListFromTenantSettings(settings: unknown, key: string): string[] {
  const ref = (settings as { references?: Record<string, unknown> } | null | undefined)?.references;
  const v = ref?.[key];
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((s) => s.trim());
}

/**
 * Ekspektor filtrlari va «Условия привязки → Территория» tanlovlari.
 * Avval faqat boshqa ekspektorlarning `User.territory` qatoridan yig‘ilgan — bo‘sh tenantlarda «Нет вариантов» chiqardi.
 * Endi tenant `references` (viloyat/shahar/tuman/zona/mahalla) va mijoz jadvalidagi noyob qiymatlar ham qo‘shiladi
 * (`expeditorRulesMatch` mijoz manzil matnida substring qidiradi).
 */
export async function listExpeditorFilterOptions(tenantId: number): Promise<{
  branches: string[];
  trade_directions: string[];
  positions: string[];
  territories: string[];
  /** Filtrlarda «область/город» uchun qisqa tokenlar (territory qatoridan ajratilgan) */
  territory_tokens: string[];
  /** Kaskad: oblast (region) — shaharlar bilan chalkashmasin */
  territory_oblasts: string[];
  /** Kaskad: shahar */
  territory_cities: string[];
}> {
  const [rows, dbTrade, tenantRow, cr, cc, cd, cz, cn] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "expeditor" },
      select: { territory: true }
    }),
    listActiveTradeDirectionLabels(tenantId),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, region: { not: null } },
      distinct: ["region"],
      select: { region: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, city: { not: null } },
      distinct: ["city"],
      select: { city: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, district: { not: null } },
      distinct: ["district"],
      select: { district: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, zone: { not: null } },
      distinct: ["zone"],
      select: { zone: true }
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, neighborhood: { not: null } },
      distinct: ["neighborhood"],
      select: { neighborhood: true }
    })
  ]);
  const branches = new Set<string>();
  const trade_directions = new Set<string>();
  const positions = new Set<string>();
  const territories = new Set<string>();
  const territory_tokens = new Set<string>();
  const territory_oblasts = new Set<string>();
  const territory_cities = new Set<string>();

  const st = tenantRow?.settings;
  const refObj = (st as { references?: Record<string, unknown> } | null | undefined)?.references;

  for (const name of activeBranchNamesFromReferences(refObj)) branches.add(name);
  for (const label of await listStaffPositionPresetLabels(tenantId, st)) positions.add(label);

  const pushToken = (set: Set<string>, raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (t.length < 2) return;
    set.add(t);
  };

  const pushTerritoryToken = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (t.length < 2) return;
    territories.add(t);
    territory_tokens.add(t);
    for (const part of t.split(/[,;\n|]+/)) {
      const p = part.trim();
      if (p.length >= 2) territory_tokens.add(p);
    }
  };

  for (const r of rows) {
    if (r.territory?.trim()) {
      territories.add(r.territory.trim());
      for (const part of r.territory.split(/[,;\n|]+/)) {
        const t = part.trim();
        if (t.length >= 2) territory_tokens.add(t);
      }
    }
  }

  for (const s of territoryRegionPickerNames(refObj)) {
    pushTerritoryToken(s);
    pushToken(territory_oblasts, s);
  }
  for (const s of refStringListFromTenantSettings(st, "client_cities")) {
    pushTerritoryToken(s);
    pushToken(territory_cities, s);
  }
  for (const s of refStringListFromTenantSettings(st, "client_districts")) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_zones")) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_neighborhoods")) pushTerritoryToken(s);

  for (const r of cr) {
    pushTerritoryToken(r.region);
    pushToken(territory_oblasts, r.region);
  }
  for (const r of cc) {
    pushTerritoryToken(r.city);
    pushToken(territory_cities, r.city);
  }
  for (const r of cd) pushTerritoryToken(r.district);
  for (const r of cz) pushTerritoryToken(r.zone);
  for (const r of cn) pushTerritoryToken(r.neighborhood);

  for (const v of dbTrade) trade_directions.add(v);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    branches: [...branches].sort(sort),
    trade_directions: [...trade_directions].sort(sort),
    positions: [...positions].sort(sort),
    territories: [...territories].sort(sort),
    territory_tokens: [...territory_tokens].sort(sort),
    territory_oblasts: [...territory_oblasts].sort(sort),
    territory_cities: [...territory_cities].sort(sort)
  };
}

