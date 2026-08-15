import { createHash } from "node:crypto";
import { prisma } from "../../config/database";
import {
  referencesWithResolvedTerritoryNodes,
  territoryNodesFromUnknown,
  type TerritoryNodeDto
} from "../tenant-settings/tenant-settings.service";

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

/**
 * Уникальный код строки в `territories` для узла справочника (совпадает с префиксами групп в UI).
 */
function stableAccessTerritoryCode(n: TerritoryNodeDto, usedCodes: Set<string>): string {
  const raw = (n.code ?? "").trim().toUpperCase();
  let base: string;
  if (raw && /^[A-Z0-9_]+$/.test(raw)) {
    base = raw.slice(0, 64);
  } else {
    const id = (n.id ?? "").trim();
    base = id
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase()
      .slice(0, 64);
  }
  if (!base) base = "T";

  let code = base;
  let i = 0;
  while (usedCodes.has(code)) {
    i++;
    const suffix = `_${i}`;
    code = (base.slice(0, Math.max(1, 64 - suffix.length)) + suffix).slice(0, 64);
  }
  usedCodes.add(code);
  return code;
}

/** Один проход по `territory_nodes` — и для upsert, и для дерева UI. */
export type AccessTerritorySyncPayload = {
  roots: TerritoryNodeDto[];
  items: { code: string; name: string }[];
};

/** Узел дерева для UI «Доступ» — та же иерархия, что в `settings/references/territory_nodes`. */
export type AccessTerritoryTreeNode = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  children: AccessTerritoryTreeNode[];
};

export type TerritoryRowLite = { id: number; name: string; code: string | null; is_active: boolean };

export function buildAccessTerritorySyncPayload(settingsUnknown: unknown): AccessTerritorySyncPayload | null {
  const st = asRecord(settingsUnknown);
  const ref = asRecord(st.references);
  const refT = referencesWithResolvedTerritoryNodes(ref);
  const roots = territoryNodesFromUnknown(refT.territory_nodes);
  if (roots.length === 0) return null;

  const usedCodes = new Set<string>();
  const items: { code: string; name: string }[] = [];

  const walk = (list: TerritoryNodeDto[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = (n.name ?? "").trim();
      if (!name) {
        if (n.children?.length) walk(n.children);
        continue;
      }
      const code = stableAccessTerritoryCode(n, usedCodes);
      items.push({ code, name });
      if (n.children?.length) walk(n.children);
    }
  };

  walk(roots);
  if (items.length === 0) return null;
  return { roots, items };
}

function digestForTerritoryItems(items: { code: string; name: string }[]): string {
  return createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

export function computeAccessTerritoryCatalogDigest(payload: AccessTerritorySyncPayload | null): string {
  if (!payload?.items.length) return "__empty__";
  return digestForTerritoryItems(payload.items);
}

/** Пропуск тяжёлого upsert при неизменном справочнике. */
const territorySyncDigestCache = new Map<number, { digest: string; at: number }>();
const TERRITORY_SYNC_SKIP_MS = 300_000;

/** Готовый ответ GET /access/territories (без findMany при повторе в течение TTL). */
type TerritoryCatalogCacheEntry = {
  digest: string;
  rows: TerritoryRowLite[];
  tree: AccessTerritoryTreeNode[];
  at: number;
};
const territoryCatalogResponseCache = new Map<number, TerritoryCatalogCacheEntry>();
const RESPONSE_CATALOG_CACHE_MS = 90_000;

export function tryTerritoryCatalogResponseCache(
  tenantId: number,
  digest: string
): { rows: TerritoryRowLite[]; tree: AccessTerritoryTreeNode[] } | null {
  const hit = territoryCatalogResponseCache.get(tenantId);
  if (!hit || hit.digest !== digest || Date.now() - hit.at > RESPONSE_CATALOG_CACHE_MS) return null;
  return { rows: hit.rows, tree: hit.tree };
}

export function setTerritoryCatalogResponseCache(
  tenantId: number,
  digest: string,
  rows: TerritoryRowLite[],
  tree: AccessTerritoryTreeNode[]
): void {
  territoryCatalogResponseCache.set(tenantId, { digest, rows, tree, at: Date.now() });
}

export function invalidateAccessTerritorySyncCache(tenantId: number): void {
  territorySyncDigestCache.delete(tenantId);
  territoryCatalogResponseCache.delete(tenantId);
}

/**
 * Upsert строк `territories` по payload. При совпадении digest с недавним sync — без транзакции,
 * но только если в БД уже есть активные строки (иначе digest-кэш мог «пропустить» пустую таблицу).
 */
export async function syncTerritoriesFromPayload(
  tenantId: number,
  payload: AccessTerritorySyncPayload | null
): Promise<void> {
  if (!payload) {
    territorySyncDigestCache.delete(tenantId);
    return;
  }

  const digest = digestForTerritoryItems(payload.items);
  const now = Date.now();
  const cached = territorySyncDigestCache.get(tenantId);
  if (cached && cached.digest === digest && now - cached.at < TERRITORY_SYNC_SKIP_MS) {
    const existing = await prisma.territory.count({
      where: { tenant_id: tenantId, deleted_at: null }
    });
    if (existing > 0) return;
    territorySyncDigestCache.delete(tenantId);
  }

  const UPSERT_CHUNK = 40;
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < payload.items.length; i += UPSERT_CHUNK) {
      const slice = payload.items.slice(i, i + UPSERT_CHUNK);
      await Promise.all(
        slice.map((item) =>
          tx.territory.upsert({
            where: {
              tenant_id_code: {
                tenant_id: tenantId,
                code: item.code
              }
            },
            create: {
              tenant_id: tenantId,
              name: item.name,
              code: item.code,
              is_active: true
            },
            update: {
              name: item.name,
              is_active: true,
              deleted_at: null
            }
          })
        )
      );
    }
  });

  territorySyncDigestCache.set(tenantId, { digest, at: now });
}

/**
 * Таблица `territories` может быть пустой, пока справочник живёт в `tenant.settings.references.territory_nodes`.
 * Для GET /access/territories предпочтительнее один вызов с уже загруженным `settings`.
 */
export async function syncTerritoriesFromTenantReferences(
  tenantId: number,
  opts?: { settings?: unknown }
): Promise<void> {
  let settingsJson: unknown = opts?.settings;
  if (settingsJson === undefined) {
    const row = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });
    settingsJson = row?.settings;
  }
  const payload = buildAccessTerritorySyncPayload(settingsJson);
  await syncTerritoriesFromPayload(tenantId, payload);
}

/**
 * Собрать дерево в памяти (без повторного чтения tenant из БД).
 */
export function buildAccessTerritoryTreeFromPayload(
  roots: TerritoryNodeDto[],
  dbRows: TerritoryRowLite[]
): AccessTerritoryTreeNode[] {
  if (roots.length === 0) return [];

  const byCode = new Map<string, TerritoryRowLite>();
  for (const r of dbRows) {
    if (r.code) byCode.set(r.code, r);
  }

  const usedCodes = new Set<string>();

  function mapList(list: TerritoryNodeDto[]): AccessTerritoryTreeNode[] {
    const out: AccessTerritoryTreeNode[] = [];
    for (const n of list) {
      if (n.active === false) continue;
      const name = (n.name ?? "").trim();
      if (!name) {
        if (n.children?.length) out.push(...mapList(n.children));
        continue;
      }
      const code = stableAccessTerritoryCode(n, usedCodes);
      const tr = byCode.get(code);
      if (!tr) {
        if (n.children?.length) out.push(...mapList(n.children));
        continue;
      }
      const children = mapList(n.children ?? []);
      out.push({
        id: tr.id,
        name: tr.name,
        code: tr.code,
        is_active: tr.is_active,
        children
      });
    }
    return out;
  }

  return mapList(roots);
}
