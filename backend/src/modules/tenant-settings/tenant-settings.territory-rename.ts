import { Prisma } from "@prisma/client";
import type { TerritoryNodeDto } from "./tenant-settings.types";
import { territoryNodesFromUnknown } from "./tenant-settings.refs";
import { asRecord } from "./tenant-settings.shared";
import { territoryColumnDepths, territoryNodeStoredValue } from "./tenant-settings.territory";

export type TerritoryColumn = "zone" | "region" | "city";

export type TerritoryRename = {
  column: TerritoryColumn;
  depth: number;
  from: string;
  to: string;
};

type FlatNode = { id: string; stored: string; name: string; depth: number };

function flattenNodes(nodes: TerritoryNodeDto[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (list: TerritoryNodeDto[], depth: number) => {
    for (const n of list) {
      const id = String(n.id ?? "").trim();
      if (id) {
        out.push({ id, stored: territoryNodeStoredValue(n), name: (n.name ?? "").trim(), depth });
      }
      if (n.children?.length) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

/**
 * Daraxtda tugun (bir xil `id`) nomi/kodi o‘zgargan bo‘lsa — eski saqlangan qiymat → yangi.
 * Eski qiymat shu qatlamda boshqa tugunda ham ishlatilsa (masalan bir xil nomli shahar), o‘tkazilmaydi.
 */
export function collectTerritoryRenames(
  prevRefs: Record<string, unknown> | undefined,
  nextRefs: Record<string, unknown> | undefined
): TerritoryRename[] {
  const { zoneD, regionD, cityD } = territoryColumnDepths(nextRefs);
  const columnAt = (d: number): TerritoryColumn | null =>
    d === zoneD ? "zone" : d === regionD ? "region" : d === cityD ? "city" : null;

  const prev = flattenNodes(territoryNodesFromUnknown(prevRefs?.territory_nodes));
  const next = flattenNodes(territoryNodesFromUnknown(nextRefs?.territory_nodes));
  const nextById = new Map(next.map((n) => [n.id, n]));
  const usedBy = new Map<string, Set<string>>();
  for (const n of next) {
    for (const v of [n.stored, n.name]) {
      if (!v) continue;
      const key = `${n.depth}|${v.toLowerCase()}`;
      if (!usedBy.has(key)) usedBy.set(key, new Set());
      usedBy.get(key)!.add(n.id);
    }
  }

  const out: TerritoryRename[] = [];
  const seen = new Set<string>();
  for (const p of prev) {
    const n = nextById.get(p.id);
    if (!n || n.depth !== p.depth || !n.stored) continue;
    const column = columnAt(n.depth);
    if (!column) continue;
    for (const from of new Set([p.stored, p.name])) {
      if (!from || from === n.stored) continue;
      const users = usedBy.get(`${n.depth}|${from.toLowerCase()}`);
      if (users && [...users].some((id) => id !== n.id)) continue;
      const key = `${column}|${from.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ column, depth: n.depth, from, to: n.stored });
    }
  }
  return out;
}

/** «ZONA / OBLAST / SHAHAR» bog‘lanish satri: segment qatlam chuqurligi bo‘yicha almashtiriladi. */
export function renameTerritoryBinding(value: string, renames: TerritoryRename[]): string {
  const parts = value.split("/").map((s) => s.trim());
  let changed = false;
  const next = parts.map((seg, idx) => {
    const hit = renames.find(
      (r) => (parts.length === 1 || r.depth === idx) && r.from.toLowerCase() === seg.toLowerCase()
    );
    if (!hit) return seg;
    changed = true;
    return hit.to;
  });
  return changed ? next.join(" / ") : value;
}

function renameList(values: unknown, renames: TerritoryRename[]): unknown {
  if (!Array.isArray(values)) return values;
  return values.map((v) => (typeof v === "string" ? renameTerritoryBinding(v, renames) : v));
}

function withRenamedBranches(
  settings: Record<string, unknown>,
  renames: TerritoryRename[]
): Record<string, unknown> {
  const refs = asRecord(settings.references);
  if (!Array.isArray(refs.branches)) return settings;
  const areaRenames = renames.filter((r) => r.column !== "city").map((r) => ({ ...r, depth: -1 }));
  const cityRenames = renames.filter((r) => r.column === "city").map((r) => ({ ...r, depth: -1 }));
  const branches = refs.branches.map((b) => {
    if (b == null || typeof b !== "object") return b;
    const row = { ...(b as Record<string, unknown>) };
    if (typeof row.territory === "string") row.territory = renameTerritoryBinding(row.territory, areaRenames);
    if (typeof row.city === "string") row.city = renameTerritoryBinding(row.city, cityRenames);
    row.territories = renameList(row.territories, areaRenames);
    row.cities = renameList(row.cities, cityRenames);
    return row;
  });
  return { ...settings, references: { ...refs, branches } };
}

async function applyRenamesToRows(
  tx: Prisma.TransactionClient,
  tenantId: number,
  renames: TerritoryRename[]
): Promise<void> {
  for (const r of renames) {
    const col = Prisma.raw(r.column);
    await tx.$executeRaw`
      UPDATE clients SET ${col} = ${r.to}, updated_at = now()
      WHERE tenant_id = ${tenantId} AND lower(btrim(${col})) = lower(${r.from})
    `;
  }

  const slots = await tx.workSlot.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, territory: true, territories: true }
  });
  for (const s of slots) {
    const territory = s.territory ? renameTerritoryBinding(s.territory, renames) : s.territory;
    const territories = s.territories.map((t) => renameTerritoryBinding(t, renames));
    if (territory === s.territory && territories.every((t, i) => t === s.territories[i])) continue;
    await tx.workSlot.update({ where: { id: s.id }, data: { territory, territories } });
  }

  const users = await tx.user.findMany({
    where: { tenant_id: tenantId, territory: { not: null } },
    select: { id: true, territory: true }
  });
  for (const u of users) {
    const territory = renameTerritoryBinding(u.territory ?? "", renames);
    if (territory === u.territory) continue;
    await tx.user.update({ where: { id: u.id }, data: { territory } });
  }
}

/**
 * Sozlamalarda hudud nomi o‘zgarsa — mijozlar, ish o‘rinlari / xodimlar bog‘lanishi va filial
 * hududlari shu tranzaksiyada yangi nomga o‘tadi.
 */
export async function propagateTerritoryRenamesInTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  prevSettings: Record<string, unknown>,
  nextSettings: Record<string, unknown>
): Promise<{ settings: Record<string, unknown>; renames: TerritoryRename[] }> {
  const renames = collectTerritoryRenames(asRecord(prevSettings.references), asRecord(nextSettings.references));
  if (renames.length === 0) return { settings: nextSettings, renames };
  await applyRenamesToRows(tx, tenantId, renames);
  return { settings: withRenamedBranches(nextSettings, renames), renames };
}
