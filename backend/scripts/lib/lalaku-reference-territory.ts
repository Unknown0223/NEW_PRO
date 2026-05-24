/**
 * Lalaku territoriya daraxti: Excel region/shahar merge.
 */
import {
  defaultRegionTerritoryCode,
  defaultZoneTerritoryCode,
  mergeTerritoryBundle,
  normKey,
  normKeyTerritoryMatch,
  REGION_ZONE_ROWS,
  type LalakuTerritoryNode
} from "../../../shared/territory-lalaku-seed";

export { ZONE_ROOT_NAMES, REGION_ZONE_ROWS, mergeTerritoryBundle } from "../../../shared/territory-lalaku-seed";

type TerritoryNode = LalakuTerritoryNode;

type ClientRefEntry = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number | null;
  comment: string | null;
  active: boolean;
  color: string | null;
};

export function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, unknown>) };
  return {};
}

/** Excel / translit. variantlari → `REGION_ZONE_ROWS` dagi rasmiy nom */
const EXCEL_REGION_ALIAS_BY_KEY = new Map<string, string>();

function registerExcelRegionAliases(variants: string[], canonical: string) {
  for (const v of variants) {
    const key = normKey(v.replace(/[''`ʼ]/g, ""));
    if (!EXCEL_REGION_ALIAS_BY_KEY.has(key)) EXCEL_REGION_ALIAS_BY_KEY.set(key, canonical);
  }
}

for (const { region } of REGION_ZONE_ROWS) {
  registerExcelRegionAliases([region], region);
}
registerExcelRegionAliases(["FARG'ONA VILOYATI", "FERGANA VILOYATI"], "FARGONA VILOYATI");
registerExcelRegionAliases(["BUXHARO VILOYATI", "BUKHARA VILOYATI"], "BUXORO VILOYATI");
registerExcelRegionAliases(["NAVOI VILOYATI", "NAWOIY VILOYATI"], "NAVOIY VILOYATI");
registerExcelRegionAliases(["ANDIZHAN VILOYATI"], "ANDIJON VILOYATI");
registerExcelRegionAliases(
  [
    "KARAKALPAKSTAN",
    "QORAQUALPAQ RESPUBLIKASI",
    "QORAQALPOQ RESPUBLIKASI",
    "QORA QALPOQ RESPUBLIKASI",
    "RESPUBLICA KARAKALPAKSTAN"
  ],
  "QORAQALPOQISTON"
);
registerExcelRegionAliases(["TASHKENT VILOYATI", "TASHKENT OBLAST"], "TOSHKENT VILOYATI");
registerExcelRegionAliases(["TASHKENT SHAHAR", "TASHKENT CITY", "G.TOSHKENT"], "TOSHKENT SHAHAR");
registerExcelRegionAliases(["JIZZAH VILOYATI"], "JIZZAX VILOYATI");
registerExcelRegionAliases(["KASHKADARYA VILOYATI"], "QASHQADARYO VILOYATI");
registerExcelRegionAliases(["SURKHANDARYA VILOYATI"], "SURXANDARYO VILOYATI");
registerExcelRegionAliases(["SYRDARYA VILOYATI"], "SIRDARYO VILOYATI");
registerExcelRegionAliases(["SAMARKAND VILOYATI"], "SAMARQAND VILOYATI");
registerExcelRegionAliases(["KHOREZM VILOYATI", "HOREZM VILOYATI"], "XORAZM VILOYATI");

export function canonicalRegionNameFromExcel(regionRaw: string): string {
  const t = regionRaw.trim();
  if (!t) return t;
  const k = normKey(t.replace(/[''`ʼ]/g, ""));
  return EXCEL_REGION_ALIAS_BY_KEY.get(k) ?? t;
}

export function slugId(prefix: string, key: string): string {
  const k = normKey(key).replace(/\s+/g, "-").replace(/[^A-Z0-9-]/gi, "");
  return `${prefix}-${k.slice(0, 48)}`;
}

export function simpleHash36(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function warehouseCodeFromName(name: string): string {
  const base = normKey(name)
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 36);
  return base || `WH_${simpleHash36(name)}`.slice(0, 20);
}

export function parseTerritoryNodes(v: unknown): TerritoryNode[] {
  if (!Array.isArray(v)) return [];
  const parseOne = (item: unknown): TerritoryNode | null => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id || !name) return null;
    const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
    const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
    const comment = typeof row.comment === "string" ? row.comment.trim() : "";
    const sort_order =
      typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
    const active = typeof row.active === "boolean" ? row.active : true;
    const rawChildren = row.children;
    const children = Array.isArray(rawChildren)
      ? rawChildren.map(parseOne).filter((x): x is TerritoryNode => x != null)
      : [];
    return { id, name, code, comment: comment || null, sort_order, active, children };
  };
  return v.map(parseOne).filter((x): x is TerritoryNode => x != null);
}

export function normalizeTerritoryLabel(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.toUpperCase() === t ? t : t.toUpperCase();
}

/** Faqat zona → viloyat qatlami (shahar nomi tasodifiy mos kelmasin). */
export function findTerritoryRegionNodesByNameKey(forest: TerritoryNode[], canonicalRegion: string): TerritoryNode[] {
  const target = normKeyTerritoryMatch(canonicalRegion);
  const hits: TerritoryNode[] = [];
  for (const z of forest) {
    for (const r of z.children ?? []) {
      if (normKeyTerritoryMatch(r.name) === target) hits.push(r);
    }
  }
  return hits;
}

export function regionChildExistsUnderOtherRootZone(
  forest: TerritoryNode[],
  zoneNode: TerritoryNode,
  rKey: string
): boolean {
  const target = normKeyTerritoryMatch(rKey);
  for (const z of forest) {
    if (z === zoneNode) continue;
    if (z.children?.some((c) => normKeyTerritoryMatch(c.name) === target)) return true;
  }
  return false;
}

export function parseClientRefEntries(v: unknown): ClientRefEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item): ClientRefEntry | null => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) return null;
      const codeRaw = typeof row.code === "string" ? row.code.trim().toUpperCase() : "";
      const code = codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : null;
      const sort_order =
        typeof row.sort_order === "number" && Number.isInteger(row.sort_order) ? row.sort_order : null;
      const comment = typeof row.comment === "string" ? row.comment.trim() : "";
      const active = typeof row.active === "boolean" ? row.active : true;
      const colorRaw = typeof row.color === "string" ? row.color.trim() : "";
      const color = colorRaw ? colorRaw.slice(0, 32) : null;
      return { id, name, code, sort_order, comment: comment || null, active, color };
    })
    .filter((x): x is ClientRefEntry => x != null);
}

export function activeValuesFromClientRefEntries(entries: ClientRefEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.active === false) continue;
    const v = (e.code && e.code.trim() !== "" ? e.code.trim() : e.name.trim()) || "";
    if (v) out.push(v);
  }
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b, "uz"));
}

export function mergeStringList(existing: string[], add: string[]): string[] {
  const s = new Set<string>();
  for (const x of existing) {
    const t = x.trim();
    if (t) s.add(t);
  }
  for (const x of add) {
    const t = x.trim();
    if (t) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "uz"));
}

export function mergeClientRefByCodeOrName(
  existing: ClientRefEntry[],
  defs: { name: string; code: string }[],
  idPrefix: string
): ClientRefEntry[] {
  const out = [...existing];
  const seenCode = new Set(
    out.map((e) => (e.code ? normKey(e.code) : "")).filter(Boolean)
  );
  const seenName = new Set(out.map((e) => normKey(e.name)));

  let i = 0;
  for (const d of defs) {
    const ck = normKey(d.code);
    const nk = normKey(d.name);
    if (seenCode.has(ck) || seenName.has(nk)) continue;
    seenCode.add(ck);
    seenName.add(nk);
    out.push({
      id: `${idPrefix}-${ck}-${simpleHash36(d.name)}`,
      name: d.name,
      code: d.code,
      sort_order: i++,
      comment: null,
      active: true,
      color: null
    });
  }
  return out;
}