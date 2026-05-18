import { prisma } from "../../config/database";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";

export async function listAgentFilterOptions(tenantId: number): Promise<{
  branches: string[];
  trade_directions: string[];
  positions: string[];
  /** Agent `User.territory` to‘liq qiymatlari (zona / uchastok tanlash) */
  territories: string[];
  /** Viloyat, shahar va boshqa tokenlar (`territory` qatorida qidiruv) */
  territory_tokens: string[];
}> {
  const [rows, dbTrade, tenantRow, cr, cc, cd, cz, cn] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "agent" },
      select: { branch: true, trade_direction: true, position: true, territory: true }
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
    if (r.branch?.trim()) branches.add(r.branch.trim());
    if (r.trade_direction?.trim()) trade_directions.add(r.trade_direction.trim());
    if (r.position?.trim()) positions.add(r.position.trim());
    if (r.territory?.trim()) {
      const full = r.territory.trim();
      territories.add(full);
      pushAgentTerritoryToken(full);
    }
  }

  const st = tenantRow?.settings;
  const refObj = (st as { references?: Record<string, unknown> } | null | undefined)?.references;
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
    territory_tokens: [...territory_tokens].sort(sort)
  };
}

export async function listSupervisorFilterOptions(tenantId: number): Promise<{ positions: string[] }> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "supervisor" },
    select: { position: true }
  });
  const positions = new Set<string>();
  for (const r of rows) {
    if (r.position?.trim()) positions.add(r.position.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return { positions: [...positions].sort(sort) };
}

export async function listCollectorFilterOptions(tenantId: number): Promise<{ positions: string[]; territories: string[] }> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "collector" },
    select: { position: true, territory: true }
  });
  const positions = new Set<string>();
  const territories = new Set<string>();
  for (const r of rows) {
    if (r.position?.trim()) positions.add(r.position.trim());
    if (r.territory?.trim()) territories.add(r.territory.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return { positions: [...positions].sort(sort), territories: [...territories].sort(sort) };
}

export async function listAuditorFilterOptions(tenantId: number): Promise<{ positions: string[]; territories: string[] }> {
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "auditor" },
    select: { position: true, territory: true }
  });
  const positions = new Set<string>();
  const territories = new Set<string>();
  for (const r of rows) {
    if (r.position?.trim()) positions.add(r.position.trim());
    if (r.territory?.trim()) territories.add(r.territory.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return { positions: [...positions].sort(sort), territories: [...territories].sort(sort) };
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
}> {
  const [rows, dbTrade, tenantRow, cr, cc, cd, cz, cn] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "expeditor" },
      select: { branch: true, trade_direction: true, position: true, territory: true }
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
    if (r.branch?.trim()) branches.add(r.branch.trim());
    if (r.trade_direction?.trim()) trade_directions.add(r.trade_direction.trim());
    if (r.position?.trim()) positions.add(r.position.trim());
    if (r.territory?.trim()) {
      territories.add(r.territory.trim());
      for (const part of r.territory.split(/[,;\n|]+/)) {
        const t = part.trim();
        if (t.length >= 2) territory_tokens.add(t);
      }
    }
  }

  const st = tenantRow?.settings;
  const refObj = (st as { references?: Record<string, unknown> } | null | undefined)?.references;
  for (const s of territoryRegionPickerNames(refObj)) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_cities")) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_districts")) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_zones")) pushTerritoryToken(s);
  for (const s of refStringListFromTenantSettings(st, "client_neighborhoods")) pushTerritoryToken(s);

  for (const r of cr) pushTerritoryToken(r.region);
  for (const r of cc) pushTerritoryToken(r.city);
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
    territory_tokens: [...territory_tokens].sort(sort)
  };
}

