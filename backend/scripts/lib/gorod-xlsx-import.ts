/**
 * «Данные Город» — bitta Excel: Gorod kodi, Gorod, viloyat, zona.
 * Zona → Oblast → Gorod daraxtini va spravochnik maydonlarini to‘ldiradi.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { territoryRegionPickerNames } from "../../src/modules/tenant-settings/tenant-settings.service";
import {
  buildTerritoryForestWithRegionAndCityRows,
  canonicalRegionNameFromExcel,
  type CityXlsxRow,
  type RegionXlsxRow
} from "./lalaku-reference-import";
import {
  backfillZoneAndRegionCodes,
  DEFAULT_TERRITORY_LEVELS,
  overlayCityCodesFromRows,
  verifyTerritorySync,
  printTerritoryVerifyReport
} from "./territory-codes-enrich";
import { findExcelInDownloads } from "./excel-download-paths";
import { normKey, normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";

export type GorodXlsxRow = {
  order_num: number | null;
  code: string;
  name: string;
  region: string;
  zone: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, unknown>) };
  return {};
}

function headerLooksUnified(row: unknown[]): boolean {
  const cells = row.map((c) => String(c ?? "").trim().toLowerCase());
  const joined = cells.join("|");
  return (
    joined.includes("gorod") &&
    (joined.includes("zona") || joined.includes("зона")) &&
    (joined.includes("oblist") || joined.includes("област") || joined.includes("регион"))
  );
}

type GorodColumnLayout = {
  nameIdx: number;
  codeIdx: number;
  regionIdx: number;
  zoneIdx: number;
  oblastIdx: number;
};

function normHeaderCell(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Sarlavha qatoridan ustun indekslari (Gorod | kod Gorod | … yoki Gorod Kod | Gorod | …). */
function detectGorodColumnLayout(header: unknown[]): GorodColumnLayout | null {
  const cells = header.map(normHeaderCell);
  const pick = (pred: (h: string, i: number) => boolean): number => {
    for (let i = 0; i < cells.length; i++) {
      if (pred(cells[i]!, i)) return i;
    }
    return -1;
  };

  const nameIdx = pick(
    (h) =>
      (h === "gorod" || h === "город" || h === "имя" || h === "shahar" || h === "name") &&
      !h.includes("kod") &&
      !h.includes("код")
  );
  const codeIdx = pick(
    (h) =>
      h.includes("kod gorod") ||
      h.includes("gorod kod") ||
      h.includes("код города") ||
      ((h.includes("kod") || h.includes("код")) && !h.includes("ikpu") && !h.includes("1с"))
  );
  const regionIdx = pick(
    (h) =>
      h.includes("название региона") ||
      h.includes("регион") ||
      h.includes("viloyat") ||
      h.includes("oblast") ||
      h.includes("област")
  );
  const zoneIdx = pick((h) => h === "zona" || h === "зона" || (h.includes("zona") && !h.includes("gorod")));
  const oblastIdx = pick((h) => h === "oblist" || h === "област");

  if (nameIdx < 0 || regionIdx < 0) return null;
  return { nameIdx, codeIdx, regionIdx, zoneIdx, oblastIdx };
}

function isValidCityCode(code: string): boolean {
  return /^[A-Z0-9_]+$/.test(code);
}

/** Excel zonasi → tizimdagi standart zona nomi. */
export function canonicalZoneNameFromExcel(zoneRaw: string): string {
  const t = zoneRaw.trim();
  if (!t) return t;
  const k = normKey(t.replace(/-/g, " "));
  if (k === "TASH OBL" || k === "TASHOBL") return "TASH OBL";
  if (k === "SOUTH WEST" || k === "SOUTHWEST") return "SOUTH-WEST";
  return t.toUpperCase() === t ? t : t.toUpperCase();
}

function parseOrderNum(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return null;
}

function sanitizeCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 20);
}

/**
 * Yangi format (sarlavhali):
 *   Gorod | kod Gorod | Название региона | Zona
 *   Gorod Kod | Gorod | Название региона | Oblist | Zona
 * Eski format: # | Имя | Код | Название региона
 */
export function parseGorodRowsFromXlsx(filePath: string): GorodXlsxRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fayl topilmadi: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const sn = wb.SheetNames[0];
  if (!sn) throw new Error("Varaq topilmadi");
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sn], { header: 1, defval: "" });
  if (matrix.length === 0) throw new Error("Excel bo‘sh");

  const first = matrix[0];
  const unified = Array.isArray(first) && headerLooksUnified(first);
  const layout = unified && Array.isArray(first) ? detectGorodColumnLayout(first) : null;

  const out: GorodXlsxRow[] = [];
  const start = unified ? 1 : 0;

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row) || row.length < 2) continue;

    if (unified && layout) {
      const name = String(row[layout.nameIdx] ?? "").trim();
      const code =
        layout.codeIdx >= 0 ? sanitizeCode(String(row[layout.codeIdx] ?? "")) : "";
      const regionCol = String(row[layout.regionIdx] ?? "").trim();
      const oblastCol = layout.oblastIdx >= 0 ? String(row[layout.oblastIdx] ?? "").trim() : "";
      const zoneCol = layout.zoneIdx >= 0 ? String(row[layout.zoneIdx] ?? "").trim() : "";
      const region = regionCol || oblastCol;
      const zone = canonicalZoneNameFromExcel(zoneCol);

      if (!name || !region) continue;
      if (layout.zoneIdx >= 0 && !zone) continue;
      if (!code || !isValidCityCode(code)) continue;

      out.push({ order_num: parseOrderNum(i), code, name, region, zone });
      continue;
    }

    if (unified) {
      const codeFirst = sanitizeCode(String(row[0] ?? ""));
      const nameFirst = String(row[1] ?? "").trim();
      if (isValidCityCode(codeFirst)) {
        const regionCol = String(row[2] ?? "").trim();
        const oblastCol = String(row[3] ?? "").trim();
        const zoneCol = String(row[4] ?? "").trim();
        const region = regionCol || oblastCol;
        const zone = canonicalZoneNameFromExcel(zoneCol);
        if (codeFirst && nameFirst && region && zone) {
          out.push({ order_num: parseOrderNum(i), code: codeFirst, name: nameFirst, region, zone });
        }
        continue;
      }
      const codeSecond = sanitizeCode(String(row[1] ?? ""));
      const nameSecond = String(row[0] ?? "").trim();
      const region = String(row[2] ?? "").trim();
      const zone = canonicalZoneNameFromExcel(String(row[3] ?? "").trim());
      if (isValidCityCode(codeSecond) && nameSecond && region && zone) {
        out.push({ order_num: parseOrderNum(i), code: codeSecond, name: nameSecond, region, zone });
      }
      continue;
    }

    const h0 = String(row[0] ?? "").trim().toLowerCase();
    const h1 = String(row[1] ?? "").trim().toLowerCase();
    if (h0 === "#" && (h1 === "имя" || h1 === "ism" || h1 === "name")) continue;

    const order_num = parseOrderNum(row[0]);
    const name = String(row[1] ?? "").trim();
    const code = sanitizeCode(String(row[2] ?? ""));
    const region = String(row[3] ?? "").trim();
    if (!name || !region) continue;

    const c0 = row[0];
    if (
      typeof c0 === "string" &&
      c0.trim() !== "" &&
      h0 !== "#" &&
      !/^\d+$/.test(c0.trim()) &&
      order_num == null
    ) {
      continue;
    }

    out.push({ order_num, code, name, region, zone: "" });
  }

  return out;
}

export function gorodRowsToRegionAndCityRows(rows: GorodXlsxRow[]): {
  regionRows: RegionXlsxRow[];
  cityRows: CityXlsxRow[];
} {
  const regionSeen = new Set<string>();
  const regionRows: RegionXlsxRow[] = [];
  const cityRows: CityXlsxRow[] = [];

  for (const row of rows) {
    const region = canonicalRegionNameFromExcel(row.region);
    const zone = row.zone.trim() ? canonicalZoneNameFromExcel(row.zone) : "";
    if (zone) {
      const rk = `${normKeyTerritoryMatch(zone)}|||${normKeyTerritoryMatch(region)}`;
      if (!regionSeen.has(rk)) {
        regionSeen.add(rk);
        regionRows.push({ order_num: null, region, zone });
      }
    }

    cityRows.push({
      order_num: row.order_num,
      name: row.name,
      code: row.code,
      region
    });
  }

  return { regionRows, cityRows };
}

export function resolveGorodXlsxPath(cwdBackend: string, cliPath?: string): string {
  const fromCli = (cliPath || "").trim();
  if (fromCli) {
    const abs = path.isAbsolute(fromCli) ? fromCli : path.join(cwdBackend, fromCli);
    if (!fs.existsSync(abs)) throw new Error(`Fayl topilmadi: ${abs}`);
    return abs;
  }

  const env = (process.env.CITY_XLSX_PATH || process.env.GOROD_XLSX_PATH || "").trim();
  if (env) {
    const abs = path.isAbsolute(env) ? env : path.join(cwdBackend, env);
    if (!fs.existsSync(abs)) throw new Error(`CITY_XLSX_PATH berildi, fayl yo‘q: ${abs}`);
    return abs;
  }

  const candidates = [
    path.join(cwdBackend, "scripts", "data", "Данные Город (1).xlsx"),
    path.join(cwdBackend, "scripts", "data", "Данные Город.xlsx"),
    path.join(cwdBackend, "scripts", "data", "gorod.xlsx")
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }

  const fromDownloads = findExcelInDownloads(
    ["Данные Город (1).xlsx", "Данные Город.xlsx", "gorod.xlsx"],
    ["город", "gorod", "данные город"]
  );
  if (fromDownloads) return fromDownloads;

  throw new Error(
    "Excel topilmadi. Yo‘l bering: npm run import:gorod-xlsx -- \"C:\\path\\Данные Город.xlsx\""
  );
}

export type RunGorodXlsxImportOpts = {
  prisma: PrismaClient;
  tenantId: number;
  tenantSlug: string;
  xlsxPath: string;
  dry: boolean;
  allowProdWrite: boolean;
};

export async function runGorodXlsxImport(opts: RunGorodXlsxImportOpts): Promise<{
  written: boolean;
  gorodRowCount: number;
  regionRowCount: number;
  cityRowCount: number;
}> {
  const { prisma, tenantId, tenantSlug, xlsxPath, dry, allowProdWrite } = opts;

  if (process.env.NODE_ENV === "production" && !dry && !allowProdWrite) {
    throw new Error("Productionda yozish: ALLOW_PROD_GOROD_IMPORT=true");
  }

  const gorodRows = parseGorodRowsFromXlsx(xlsxPath);
  if (gorodRows.length === 0) {
    throw new Error("Excel dan yaroqli qator yo‘q (Gorod kodi + Gorod + viloyat + zona majburiy).");
  }

  const missingZone = gorodRows.filter((r) => !r.zone.trim()).length;
  if (missingZone > 0) {
    throw new Error(
      `${missingZone} qatorda zona yo‘q. Yangi formatda «Zona» ustuni bo‘lishi kerak (Gorod Kod | Gorod | … | Zona).`
    );
  }

  const { regionRows, cityRows } = gorodRowsToRegionAndCityRows(gorodRows);

  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const ref = asRecord(st.references);

  const { forest, regionStats, cityStats } = buildTerritoryForestWithRegionAndCityRows(
    ref.territory_nodes,
    regionRows,
    cityRows
  );

  backfillZoneAndRegionCodes(forest);
  const cityPatched = overlayCityCodesFromRows(forest, cityRows);
  const verify = verifyTerritorySync(forest, cityRows);

  const cityCodes = [...new Set(gorodRows.map((r) => r.code).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  const zones = [...new Set(gorodRows.map((r) => canonicalZoneNameFromExcel(r.zone)))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  console.log(`\n=== Gorod import (${tenantSlug}, id=${tenantId}) ===`);
  console.log(`  Fayl: ${xlsxPath}`);
  console.log(`  Qatorlar: ${gorodRows.length} (zona: ${zones.length}, viloyat: ${regionRows.length})`);
  console.log(
    `  Daraxt: +${regionStats.added_regions} viloyat | +${regionStats.added_zones} zona | +${cityStats.added} shahar | takror: ${cityStats.skipped_duplicate}`
  );
  console.log(`  Shahar kodlari: ${cityCodes.length} | overlay yangilandi: ${cityPatched}`);
  if (cityStats.missing_regions.length) {
    console.warn("  Viloyat topilmadi:", cityStats.missing_regions.join(", "));
  }
  printTerritoryVerifyReport(verify);

  if (dry) {
    console.log("[dry] DB ga yozilmadi.");
    return {
      written: false,
      gorodRowCount: gorodRows.length,
      regionRowCount: regionRows.length,
      cityRowCount: cityRows.length
    };
  }

  const regions = territoryRegionPickerNames({
    ...ref,
    territory_nodes: forest as unknown,
    territory_levels: [...DEFAULT_TERRITORY_LEVELS]
  } as Record<string, unknown>);

  const prevCities = Array.isArray(ref.client_cities)
    ? ref.client_cities.filter((x): x is string => typeof x === "string")
    : [];
  const mergedCities = [...new Set([...prevCities, ...cityCodes])].sort((a, b) => a.localeCompare(b, "ru"));

  const prevZones = Array.isArray(ref.client_zones)
    ? ref.client_zones.filter((x): x is string => typeof x === "string")
    : [];
  const mergedZones = [...new Set([...prevZones, ...zones])].sort((a, b) => a.localeCompare(b, "ru"));

  const nextRef = {
    ...ref,
    territory_nodes: forest,
    territory_levels: [...DEFAULT_TERRITORY_LEVELS],
    regions,
    client_cities: mergedCities,
    client_zones: mergedZones
  };
  const nextSettings = { ...st, references: nextRef };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue }
  });

  const { invalidateTenantSettingsCache } = await import("../../src/lib/redis-cache");
  await invalidateTenantSettingsCache(tenantId);
  const accessSync = await import("../../src/modules/access/access-territories-sync");
  accessSync.invalidateAccessTerritorySyncCache(tenantId);

  console.log("✓ territory_nodes + territory_levels + regions + client_cities + client_zones saqlandi.");
  return {
    written: true,
    gorodRowCount: gorodRows.length,
    regionRowCount: regionRows.length,
    cityRowCount: cityRows.length
  };
}
