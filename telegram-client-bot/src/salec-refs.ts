import { getPool } from "./db.js";
import type { ClientDraft, RefOption, WizardField } from "./types.js";

export type CityHint = {
  city_label: string | null;
  region: string | null;
  region_label: string | null;
  zone: string | null;
  zone_label: string | null;
};

export type TenantRefs = {
  sales_channel: RefOption[];
  category: RefOption[];
  client_type: RefOption[];
  client_format: RefOption[];
  region: RefOption[];
  city: RefOption[];
  cityHints: Record<string, CityHint>;
};

export type StaffScope = {
  scoped: boolean;
  cityValues: Set<string>;
  regionValues: Set<string>;
};

type TNode = { name?: string; code?: string; active?: boolean; children?: TNode[] };
type Entry = { code?: unknown; name?: unknown; value?: unknown; label?: unknown; active?: unknown };

const CITY_PREFIX: Array<{ prefix: string; zone: string; region: string }> = [
  { prefix: "AD_", zone: "FV", region: "ANDIJON VILOYATI" },
  { prefix: "FR_", zone: "FV", region: "FARGONA VILOYATI" },
  { prefix: "NM_", zone: "FV", region: "NAMANGAN VILOYATI" },
  { prefix: "QQ_", zone: "FV", region: "QOQON" },
  { prefix: "BX_", zone: "SOUTH-WEST", region: "BUXORO VILOYATI" },
  { prefix: "JZ_", zone: "SOUTH-WEST", region: "JIZZAX VILOYATI" },
  { prefix: "NK_", zone: "SOUTH-WEST", region: "QORAQALPOQISTON" },
  { prefix: "NV_", zone: "SOUTH-WEST", region: "NAVOIY VILOYATI" },
  { prefix: "QS_", zone: "SOUTH-WEST", region: "QASHQADARYO VILOYATI" },
  { prefix: "SM_", zone: "SOUTH-WEST", region: "SAMARQAND VILOYATI" },
  { prefix: "SR_", zone: "SOUTH-WEST", region: "SURXANDARYO VILOYATI" },
  { prefix: "XR_", zone: "SOUTH-WEST", region: "XORAZM VILOYATI" },
  { prefix: "TV_", zone: "TASH OBL", region: "TOSHKENT VILOYATI" },
  { prefix: "TSH_", zone: "TASHKENT", region: "TOSHKENT SHAHAR" }
];

export function normKey(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function parseUserTerritoryParts(raw: string | null | undefined): {
  zone: string | null;
  oblast: string | null;
  city: string | null;
} {
  const t = raw?.trim();
  if (!t) return { zone: null, oblast: null, city: null };
  const parts = t
    .split(/\s*\/\s*|[,;|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { zone: parts[0] ?? null, oblast: parts[1] ?? null, city: parts[2] ?? null };
}

export function isLikelyRegionStored(value: string): boolean {
  const u = value.trim().toUpperCase();
  if (!u) return true;
  if (u.includes("VILOYATI") || u.endsWith("_VIL") || u === "QOQON" || u === "QORAQALPOQISTON") {
    return true;
  }
  return false;
}

export function inferCityTerritory(city: string): { zone: string; region: string } | null {
  const upper = city.trim().toUpperCase();
  if (!upper) return null;
  if (upper === "FARGONA_VIL") return { zone: "FV", region: "FARGONA VILOYATI" };
  for (const row of CITY_PREFIX) {
    if (upper.startsWith(row.prefix)) return { zone: row.zone, region: row.region };
  }
  return null;
}

function sameTok(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normKey(a);
  const nb = normKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (Math.min(na.length, nb.length) <= 2) return false;
  return na.includes(nb) || nb.includes(na);
}

function nodeStored(n: TNode): string {
  const name = String(n.name ?? "").trim();
  if (!name) return "";
  const codeRaw = String(n.code ?? "").trim().toUpperCase();
  return codeRaw && /^[A-Z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 20) : name;
}

function asNodes(raw: unknown): TNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is TNode => Boolean(n) && typeof n === "object");
}

function maxDepth(nodes: TNode[]): number {
  if (!nodes.length) return 0;
  let m = 1;
  for (const n of nodes) {
    const ch = asNodes(n.children);
    if (ch.length) m = Math.max(m, 1 + maxDepth(ch));
  }
  return m;
}

function levelsLen(ref: Record<string, unknown>): number {
  return Array.isArray(ref.territory_levels) ? ref.territory_levels.length : 0;
}

function regionDepth(ref: Record<string, unknown>, treeDepth: number): number {
  const L = levelsLen(ref);
  if (L >= 3) return 1;
  if (L >= 1) return 0;
  return treeDepth >= 3 ? 1 : 0;
}

function cityDepthOf(ref: Record<string, unknown>, treeDepth: number): number {
  const L = levelsLen(ref);
  if (L >= 3) return 2;
  if (L === 2 || L === 1) return 1;
  if (treeDepth >= 3) return 2;
  return 1;
}

function legacyTreeToNodes(raw: unknown): TNode[] {
  if (!Array.isArray(raw)) return [];
  const out: TNode[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as { zone?: unknown; region?: unknown; cities?: unknown };
    const zone = String(r.zone ?? "").trim();
    const region = String(r.region ?? "").trim();
    const cities = Array.isArray(r.cities) ? r.cities.map((c) => String(c).trim()).filter(Boolean) : [];
    if (!zone && !region) continue;
    out.push({
      name: zone || region,
      active: true,
      children: region
        ? [
            {
              name: region,
              active: true,
              children: cities.map((c) => ({ name: c, active: true, children: [] }))
            }
          ]
        : []
    });
  }
  return out;
}

function resolvedNodes(ref: Record<string, unknown>): TNode[] {
  const nodes = asNodes(ref.territory_nodes);
  if (nodes.length) return nodes;
  return legacyTreeToNodes(ref.territory_tree);
}

function collectAtDepth(nodes: TNode[], target: number): Array<{ stored: string; name: string }> {
  const byStored = new Map<string, string>();
  const walk = (list: TNode[], depth: number) => {
    for (const n of list) {
      if (n.active === false) continue;
      if (depth === target) {
        const name = String(n.name ?? "").trim();
        const stored = nodeStored(n);
        if (stored && !byStored.has(stored)) byStored.set(stored, name || stored);
      }
      const ch = asNodes(n.children);
      if (ch.length) walk(ch, depth + 1);
    }
  };
  walk(nodes, 0);
  return [...byStored.entries()].map(([stored, name]) => ({ stored, name }));
}

function buildHints(ref: Record<string, unknown>, nodes: TNode[]): Record<string, CityHint> {
  const out: Record<string, CityHint> = {};
  const treeDepth = maxDepth(nodes);
  const cityD = cityDepthOf(ref, treeDepth);
  const regionD = regionDepth(ref, treeDepth);
  const add = (hint: CityHint, stored: string, displayName: string) => {
    for (const k of [stored, displayName, stored.toUpperCase(), displayName.toUpperCase(), normKey(stored)]) {
      const t = k.trim();
      if (t && !(t in out)) out[t] = hint;
    }
  };
  const walk = (list: TNode[], depth: number, ancestors: TNode[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const chain = [...ancestors, n];
      if (depth === cityD) {
        const displayName = String(n.name ?? "").trim();
        if (displayName) {
          const stored = nodeStored(n);
          const regionNode = chain[regionD];
          const zoneNode = regionD >= 1 ? chain[0] : null;
          const hint: CityHint = {
            city_label: displayName,
            region: regionNode && regionNode !== n ? nodeStored(regionNode) || null : null,
            region_label: regionNode && regionNode !== n ? String(regionNode.name ?? "").trim() || null : null,
            zone: regionD >= 1 && zoneNode ? nodeStored(zoneNode) || null : null,
            zone_label: regionD >= 1 && zoneNode ? String(zoneNode.name ?? "").trim() || null : null
          };
          add(hint, stored, displayName);
        }
      }
      const ch = asNodes(n.children);
      if (ch.length) walk(ch, depth + 1, chain);
    }
  };
  walk(nodes, 0, []);
  return out;
}

function hintFor(hints: Record<string, CityHint>, stored: string): CityHint | undefined {
  const t = stored.trim();
  return hints[t] ?? hints[t.toUpperCase()] ?? hints[normKey(t)];
}

function pushOpt(map: Map<string, RefOption>, value: string, label: string, extra?: Partial<RefOption>) {
  const v = value.trim();
  if (!v) return;
  const lab = (label.trim() || v).trim();
  const existing = map.get(v);
  if (!existing) {
    map.set(v, { value: v, label: lab, ...extra });
    return;
  }
  if (lab && lab !== v && existing.label === existing.value) existing.label = lab;
  if (extra?.region && !existing.region) existing.region = extra.region;
  if (extra?.region_label && !existing.region_label) existing.region_label = extra.region_label;
  if (extra?.zone && !existing.zone) existing.zone = extra.zone;
}

function sortOpts(map: Map<string, RefOption>): RefOption[] {
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function entriesToOpts(raw: unknown, fallback: unknown = []): RefOption[] {
  const map = new Map<string, RefOption>();
  const eat = (src: unknown) => {
    if (!Array.isArray(src)) return;
    for (const item of src) {
      if (typeof item === "string") pushOpt(map, item, item);
      else if (item && typeof item === "object") {
        const e = item as Entry;
        if (e.active === false) continue;
        const value = String(e.code ?? e.value ?? e.name ?? "").trim();
        const label = String(e.name ?? e.label ?? e.code ?? value).trim();
        if (value) pushOpt(map, value, label);
      }
    }
  };
  eat(raw);
  if (map.size === 0) eat(fallback);
  return sortOpts(map);
}

function strArr(ref: Record<string, unknown>, key: string): string[] {
  const v = ref[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim());
}

export function decorateCity(opt: RefOption, hints: Record<string, CityHint>): RefOption {
  const hint = hintFor(hints, opt.value) ?? hintFor(hints, opt.label);
  const inf = inferCityTerritory(opt.value);
  const region = hint?.region ?? inf?.region ?? opt.region;
  const region_label = hint?.region_label ?? hint?.region ?? inf?.region ?? opt.region_label;
  const zone = hint?.zone ?? inf?.zone ?? opt.zone;
  const label = hint?.city_label?.trim() && hint.city_label !== opt.value ? hint.city_label : opt.label;
  return { ...opt, label, region, region_label, zone };
}

export function cityMatchesRegion(opt: RefOption, region: string): boolean {
  const want = region.trim();
  if (!want) return true;
  return sameTok(opt.region, want) || sameTok(opt.region_label, want) || sameTok(opt.label, want);
}

export function buildStaffScope(
  territoryStrings: string[],
  linkNames: string[],
  refs: TenantRefs
): StaffScope {
  const tokens: string[] = [];
  const addTok = (s?: string | null) => {
    const n = normKey(s);
    if (n && !tokens.includes(n)) tokens.push(n);
  };
  const explicitCities: string[] = [];
  const explicitRegions: string[] = [];
  const explicitZones: string[] = [];

  for (const raw of territoryStrings) {
    addTok(raw);
    const p = parseUserTerritoryParts(raw);
    addTok(p.zone);
    addTok(p.oblast);
    addTok(p.city);
    if (p.city) explicitCities.push(p.city);
    else if (p.oblast) explicitRegions.push(p.oblast);
    else if (p.zone) {
      const asRegion = isLikelyRegionStored(p.zone) || refs.region.some((r) => sameTok(r.value, p.zone) || sameTok(r.label, p.zone));
      if (asRegion) explicitRegions.push(p.zone);
      else explicitZones.push(p.zone);
    }
  }
  for (const n of linkNames) {
    addTok(n);
    if (isLikelyRegionStored(n)) explicitRegions.push(n);
    else explicitCities.push(n);
  }

  if (tokens.length === 0) {
    return { scoped: false, cityValues: new Set(), regionValues: new Set() };
  }

  const hitTok = (...vals: Array<string | null | undefined>) =>
    vals.some((v) => tokens.some((t) => sameTok(v, t)));

  const cityValues = new Set<string>();
  const regionValues = new Set<string>();

  for (const c of refs.city) {
    const decorated = decorateCity(c, refs.cityHints);
    const cityHit = explicitCities.some((x) => sameTok(c.value, x) || sameTok(c.label, x) || sameTok(decorated.label, x));
    const regionHit = explicitRegions.some(
      (r) => sameTok(decorated.region, r) || sameTok(decorated.region_label, r)
    );
    const zoneHit = explicitZones.some((z) => sameTok(decorated.zone, z));
    const loose =
      explicitCities.length === 0 &&
      explicitRegions.length === 0 &&
      explicitZones.length === 0 &&
      hitTok(c.value, c.label, decorated.label, decorated.region, decorated.region_label, decorated.zone);
    if (cityHit || regionHit || zoneHit || loose) {
      cityValues.add(c.value);
      if (decorated.region) regionValues.add(decorated.region);
      if (decorated.region_label) regionValues.add(decorated.region_label);
    }
  }

  for (const r of refs.region) {
    if (hitTok(r.value, r.label) || explicitRegions.some((x) => sameTok(r.value, x) || sameTok(r.label, x))) {
      regionValues.add(r.value);
      regionValues.add(r.label);
    }
  }

  return {
    scoped: cityValues.size > 0 || regionValues.size > 0,
    cityValues,
    regionValues
  };
}

export function filterOptionsForField(
  refs: TenantRefs,
  field: string,
  draft: Partial<ClientDraft>,
  scope: StaffScope | null
): RefOption[] {
  if (field === "sales_channel") return refs.sales_channel;
  if (field === "category") return refs.category;
  if (field === "client_type") return refs.client_type;
  if (field === "client_format") return refs.client_format;

  if (field === "region") {
    let opts = refs.region;
    if (scope?.scoped) {
      opts = opts.filter((o) => [...scope.regionValues].some((v) => sameTok(o.value, v) || sameTok(o.label, v)));
      if (opts.length === 0 && scope.regionValues.size > 0) {
        opts = [...scope.regionValues].map((v) => ({ value: v, label: v }));
      }
    }
    return opts;
  }

  if (field === "city") {
    let opts = refs.city
      .filter((o) => !isLikelyRegionStored(o.value))
      .map((o) => decorateCity(o, refs.cityHints));
    if (scope?.scoped && scope.cityValues.size > 0) {
      opts = opts.filter((o) => scope.cityValues.has(o.value));
    }
    const region = (draft.region ?? "").trim();
    if (region) opts = opts.filter((o) => cityMatchesRegion(o, region));
    return opts;
  }
  return [];
}

export function refsForField(refs: TenantRefs, field: string): RefOption[] {
  return filterOptionsForField(refs, field, {}, null);
}

let refsCache: { at: number; slug: string; tenantId: number; data: TenantRefs } | null = null;
const staffCache = new Map<string, { at: number; scope: StaffScope }>();

const DISTINCT_COLS = {
  category: "category",
  client_type_code: "client_type_code",
  client_format: "client_format",
  sales_channel: "sales_channel",
  city: "city",
  region: "region",
  zone: "zone"
} as const;

async function distinctCol(
  databaseUrl: string,
  tenantId: number,
  col: keyof typeof DISTINCT_COLS
): Promise<string[]> {
  const ident = DISTINCT_COLS[col];
  const db = getPool(databaseUrl);
  const r = await db.query<{ v: string }>(
    `SELECT DISTINCT btrim(${ident}) AS v FROM clients
     WHERE tenant_id = $1 AND merged_into_client_id IS NULL
       AND ${ident} IS NOT NULL AND btrim(${ident}) <> ''`,
    [tenantId]
  );
  return r.rows.map((x) => x.v);
}

function mergePairs(
  pairs: Array<{ stored: string; name: string }>,
  extra: string[],
  hints?: Record<string, CityHint>
): RefOption[] {
  const map = new Map<string, RefOption>();
  for (const p of pairs) pushOpt(map, p.stored, p.name);
  for (const s of extra) {
    const t = s.trim();
    if (!t) continue;
    const hint = hints ? hintFor(hints, t) : undefined;
    pushOpt(map, t, hint?.city_label || hint?.region_label || t);
  }
  return sortOpts(map);
}

export async function loadTenantRefs(databaseUrl: string, tenantSlug: string): Promise<TenantRefs> {
  const packed = await loadCatalog(databaseUrl, tenantSlug);
  return packed.refs;
}

export async function loadCatalog(
  databaseUrl: string,
  tenantSlug: string
): Promise<{ tenantId: number; refs: TenantRefs }> {
  if (refsCache && refsCache.slug === tenantSlug && Date.now() - refsCache.at < 5 * 60_000) {
    return { tenantId: refsCache.tenantId, refs: refsCache.data };
  }
  const db = getPool(databaseUrl);
  const t = await db.query<{ id: number; settings: unknown }>(
    `SELECT id, settings FROM tenants WHERE slug = $1 LIMIT 1`,
    [tenantSlug]
  );
  const row = t.rows[0];
  if (!row) {
    const empty: TenantRefs = {
      sales_channel: [],
      category: [],
      client_type: [],
      client_format: [],
      region: [],
      city: [],
      cityHints: {}
    };
    return { tenantId: 0, refs: empty };
  }
  const settings = (row.settings ?? {}) as { references?: Record<string, unknown> };
  const ref = settings.references ?? {};
  const nodes = resolvedNodes(ref);
  const treeDepth = maxDepth(nodes);
  const cityHints = buildHints(ref, nodes);
  const cityPairs = collectAtDepth(nodes, cityDepthOf(ref, treeDepth));
  const regionPairs = collectAtDepth(nodes, regionDepth(ref, treeDepth));

  const [salesDb, dbCat, dbType, dbFmt, dbSales, dbCity, dbRegion, dbZone] = await Promise.all([
    db.query<{ code: string | null; name: string }>(
      `SELECT code, name FROM sales_channel_refs WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [row.id]
    ),
    distinctCol(databaseUrl, row.id, "category"),
    distinctCol(databaseUrl, row.id, "client_type_code"),
    distinctCol(databaseUrl, row.id, "client_format"),
    distinctCol(databaseUrl, row.id, "sales_channel"),
    distinctCol(databaseUrl, row.id, "city"),
    distinctCol(databaseUrl, row.id, "region"),
    distinctCol(databaseUrl, row.id, "zone")
  ]);

  const salesMap = new Map<string, RefOption>();
  for (const s of salesDb.rows) {
    const value = (s.code?.trim() || s.name.trim()).trim();
    pushOpt(salesMap, value, s.name.trim() || value);
  }
  for (const x of [...strArr(ref, "sales_channels"), ...dbSales]) pushOpt(salesMap, x, x);

  const cat = entriesToOpts(ref.client_category_entries, ref.client_categories);
  const catMap = new Map(cat.map((o) => [o.value, o]));
  for (const x of dbCat) pushOpt(catMap, x, x);

  const types = entriesToOpts(ref.client_type_entries, ref.client_type_codes);
  const typeMap = new Map(types.map((o) => [o.value, o]));
  for (const x of dbType) pushOpt(typeMap, x, x);

  const fmts = entriesToOpts(ref.client_format_entries, ref.client_formats);
  const fmtMap = new Map(fmts.map((o) => [o.value, o]));
  for (const x of dbFmt) pushOpt(fmtMap, x, x);

  const inferredRegions: string[] = [];
  for (const cityStored of dbCity) {
    const inf = inferCityTerritory(cityStored);
    if (inf) inferredRegions.push(inf.region);
    const hint = hintFor(cityHints, cityStored);
    if (hint?.city_label && hint.city_label !== cityStored) {
      cityPairs.push({ stored: cityStored, name: hint.city_label });
    }
  }

  const regionExtra = [
    ...strArr(ref, "regions"),
    ...inferredRegions,
    ...dbRegion,
    ...dbZone
  ];
  const cityExtra = [...strArr(ref, "client_cities"), ...dbCity];

  const data: TenantRefs = {
    sales_channel: sortOpts(salesMap),
    category: sortOpts(catMap),
    client_type: sortOpts(typeMap),
    client_format: sortOpts(fmtMap),
    region: mergePairs(regionPairs, regionExtra),
    city: mergePairs(cityPairs, cityExtra, cityHints).map((o) => decorateCity(o, cityHints)),
    cityHints
  };
  refsCache = { at: Date.now(), slug: tenantSlug, tenantId: row.id, data };
  return { tenantId: row.id, refs: data };
}

export async function loadStaffScope(
  databaseUrl: string,
  tenantId: number,
  actorUserId: number,
  refs: TenantRefs
): Promise<StaffScope> {
  if (actorUserId < 1 || tenantId < 1) {
    return { scoped: false, cityValues: new Set(), regionValues: new Set() };
  }
  const key = `${tenantId}:${actorUserId}`;
  const hit = staffCache.get(key);
  if (hit && Date.now() - hit.at < 2 * 60_000) return hit.scope;

  const db = getPool(databaseUrl);
  const slots = await db.query<{
    user_territory: string | null;
    slot_territory: string | null;
    slot_territories: string[] | null;
  }>(
    `SELECT u.territory AS user_territory, ws.territory AS slot_territory, ws.territories AS slot_territories
     FROM users u
     LEFT JOIN slot_user_links sul
       ON sul.user_id = u.id AND sul.ended_at IS NULL AND sul.tenant_id = u.tenant_id
     LEFT JOIN work_slots ws
       ON ws.id = sul.slot_id AND ws.deleted_at IS NULL AND ws.tenant_id = u.tenant_id
     WHERE u.id = $1 AND u.tenant_id = $2`,
    [actorUserId, tenantId]
  );
  const strings: string[] = [];
  const pushS = (s?: string | null) => {
    const t = s?.trim();
    if (t && !strings.includes(t)) strings.push(t);
  };
  for (const row of slots.rows) {
    for (const t of row.slot_territories ?? []) pushS(t);
    pushS(row.slot_territory);
    pushS(row.user_territory);
  }

  let linkNames: string[] = [];
  try {
    const links = await db.query<{ code: string | null; name: string }>(
      `SELECT t.code, t.name
       FROM territory_user_links tul
       JOIN territories t ON t.id = tul.territory_id
       WHERE tul.user_id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL AND t.is_active = true`,
      [actorUserId, tenantId]
    );
    linkNames = links.rows.flatMap((r) => [r.code, r.name].filter((x): x is string => Boolean(x?.trim())));
  } catch {
    linkNames = [];
  }

  const scope = buildStaffScope(strings, linkNames, refs);
  staffCache.set(key, { at: Date.now(), scope });
  return scope;
}

export async function selectOptionsFor(
  databaseUrl: string,
  tenantSlug: string,
  field: string,
  actorUserId: number,
  draft: Partial<ClientDraft>
): Promise<{ opts: RefOption[]; scoped: boolean }> {
  const { tenantId, refs } = await loadCatalog(databaseUrl, tenantSlug);
  const scope = await loadStaffScope(databaseUrl, tenantId, actorUserId, refs);
  const opts = filterOptionsForField(refs, field, draft, scope);
  return { opts, scoped: scope.scoped };
}

export function applySelectToDraft(draft: Partial<ClientDraft>, field: WizardField, opt: RefOption): boolean {
  let cityCleared = false;
  if (field === "sales_channel") {
    draft.sales_channel = opt.value;
    draft.sales_channel_label = opt.label;
  } else if (field === "category") {
    draft.category = opt.value;
    draft.category_label = opt.label;
  } else if (field === "client_type") {
    draft.client_type = opt.value;
    draft.client_type_label = opt.label;
  } else if (field === "client_format") {
    draft.client_format = opt.value;
    draft.client_format_label = opt.label;
  } else if (field === "region") {
    const prev = (draft.region ?? "").trim();
    const changed = Boolean(prev) && !sameTok(prev, opt.value) && !sameTok(draft.region_label, opt.label);
    draft.region = opt.value;
    draft.region_label = opt.label;
    if (changed && draft.city) {
      draft.city = "";
      draft.city_label = "";
      cityCleared = true;
    }
  } else if (field === "city") {
    draft.city = opt.value;
    draft.city_label = opt.label;
    if (opt.region && !draft.region) draft.region = opt.region;
    if (opt.region_label) draft.region_label = opt.region_label;
    else if (opt.region && !draft.region_label) draft.region_label = opt.region;
    if (opt.zone) draft.zone = opt.zone;
  }
  return cityCleared;
}
