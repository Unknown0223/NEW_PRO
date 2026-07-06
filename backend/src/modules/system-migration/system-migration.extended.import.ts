import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import {
  EXTENDED_IMPORT_PHASES,
  type ExtendedTableSpec,
  type MapKey
} from "./system-migration.extended-specs";
import {
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  remapIntArray,
  stripIdTenant
} from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

function delegateOf(tx: Tx, name: string): {
  create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }>;
  update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>;
} {
  return (tx as Record<string, unknown>)[name] as ReturnType<typeof delegateOf>;
}

function prepareRow(
  row: Record<string, unknown>,
  spec: ExtendedTableSpec,
  maps: MigrationIdMaps,
  tenantId: number,
  strictFk: boolean
): Record<string, unknown> {
  let data = stripIdTenant(row);
  if (spec.dates?.length) data = hydrateDates(data, spec.dates);
  if (spec.decimals?.length) data = hydrateDecimals(data, spec.decimals);

  if (spec.fk) {
    for (const [field, mapKey] of Object.entries(spec.fk) as [string, MapKey][]) {
      if (data[field] == null) {
        data[field] = null;
        continue;
      }
      const remapped = remapId(maps[mapKey], data[field]);
      if (remapped === undefined) {
        if (strictFk) throw new Error(`MAP_MISSING:${spec.file}.${field}`);
        data[field] = null;
      } else {
        data[field] = remapped;
      }
    }
  }

  if (spec.intArrayFk) {
    for (const [field, mapKey] of Object.entries(spec.intArrayFk) as [string, MapKey][]) {
      data[field] = remapIntArray(maps[mapKey], data[field]);
    }
  }

  if (spec.hasTenantId !== false) {
    data.tenant_id = tenantId;
  }

  return data;
}

async function importProductCategories(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  warnings: string[]
): Promise<number> {
  const rows = await readZipJson<Record<string, unknown>>(zip, "data/product_categories.json");
  if (!rows.length) return 0;

  const pendingParents: Array<{ newId: number; parentOld: number }> = [];

  for (const row of rows) {
    const oldId = Number(row.id);
    const parentOld = row.parent_id != null ? Number(row.parent_id) : null;
    let data = prepareRow(row, EXTENDED_IMPORT_PHASES[0][0], maps, tenantId, false);
    data.parent_id = null;
    const created = await delegateOf(tx, "productCategory").create({ data });
    maps.productCategory.set(oldId, created.id);
    if (parentOld != null && Number.isFinite(parentOld)) {
      pendingParents.push({ newId: created.id, parentOld });
    }
  }

  for (const { newId, parentOld } of pendingParents) {
    const parentNew = maps.productCategory.get(parentOld);
    if (parentNew == null) {
      warnings.push(`product_categories: parent_id=${parentOld} topilmadi (id=${newId}).`);
      continue;
    }
    await delegateOf(tx, "productCategory").update({
      where: { id: newId },
      data: { parent_id: parentNew }
    });
  }

  return rows.length;
}

async function importTableSpec(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  spec: ExtendedTableSpec,
  warnings: string[],
  strictFk: boolean
): Promise<number> {
  if (spec.file === "product_categories") {
    return importProductCategories(tx, zip, tenantId, maps, warnings);
  }

  const rows = await readZipJson<Record<string, unknown>>(zip, `data/${spec.file}.json`);
  if (!rows.length) return 0;

  const model = delegateOf(tx, spec.delegate);

  for (const row of rows) {
    const data = prepareRow(row, spec, maps, tenantId, strictFk);
    if (spec.noId) {
      await model.create({ data });
      continue;
    }
    const oldId = Number(row.id);
    const created = await model.create({ data });
    if (spec.idMap) maps[spec.idMap].set(oldId, created.id);
  }

  return rows.length;
}

export async function importExtendedPhases(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  phaseIndexes: number[],
  warnings: string[],
  opts?: { strictFk?: boolean }
): Promise<Record<string, number>> {
  const strictFk = opts?.strictFk ?? true;
  const counts: Record<string, number> = {};

  for (const phaseIdx of phaseIndexes) {
    const phase = EXTENDED_IMPORT_PHASES[phaseIdx];
    if (!phase) continue;
    for (const spec of phase) {
      counts[spec.file] = await importTableSpec(tx, zip, tenantId, maps, spec, warnings, strictFk);
    }
  }

  return counts;
}
