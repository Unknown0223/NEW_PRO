import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationConflictPolicy } from "./system-migration.constants";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { EXTENDED_IMPORT_PHASES } from "./system-migration.extended-specs";
import {
  createWithOptionalDuplicateSkip,
  delegateOf,
  omitForUpdate,
  prepareRow
} from "./system-migration.extended.import-shared";
import { readZipJson } from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

export async function importProductCategories(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  warnings: string[],
  skipDuplicateKeys: boolean,
  conflictPolicy: MigrationConflictPolicy
): Promise<number> {
  const rows = await readZipJson<Record<string, unknown>>(zip, "data/product_categories.json");
  if (!rows.length) return 0;

  const pendingParents: Array<{ newId: number; parentOld: number }> = [];

  const cat = delegateOf(tx, "productCategory");
  let rowIdx = 0;
  for (const row of rows) {
    const oldId = Number(row.id);
    const parentOld = row.parent_id != null ? Number(row.parent_id) : null;
    let data = prepareRow(row, EXTENDED_IMPORT_PHASES[0][0], maps, tenantId, false);
    data.parent_id = null;
    rowIdx += 1;

    const name = typeof data.name === "string" ? data.name : "";
    const existingByName =
      name && cat.findFirst
        ? await cat.findFirst({ where: { tenant_id: tenantId, name } })
        : null;
    if (existingByName) {
      maps.productCategory.set(oldId, existingByName.id);
      if (conflictPolicy === "replace") {
        await cat.update({
          where: { id: existingByName.id },
          data: omitForUpdate(data)
        });
      }
      if (parentOld != null && Number.isFinite(parentOld)) {
        pendingParents.push({ newId: existingByName.id, parentOld });
      }
      continue;
    }

    let createdId: number | null = null;
    const outcome = await createWithOptionalDuplicateSkip(
      tx,
      async () => {
        const created = await cat.create({ data });
        createdId = created.id;
        return created;
      },
      { skipDuplicateKeys, savepoint: `mig_pc_${rowIdx}` }
    );
    if (outcome === "skipped") {
      const existing =
        name && cat.findFirst
          ? await cat.findFirst({ where: { tenant_id: tenantId, name } })
          : null;
      if (existing) {
        maps.productCategory.set(oldId, existing.id);
        if (conflictPolicy === "replace") {
          await cat.update({ where: { id: existing.id }, data: omitForUpdate(data) });
        }
        if (parentOld != null && Number.isFinite(parentOld)) {
          pendingParents.push({ newId: existing.id, parentOld });
        }
      } else {
        warnings.push(`product_categories: dublikat — o‘tkazib yuborildi (id=${oldId}).`);
      }
      continue;
    }
    if (createdId != null) {
      maps.productCategory.set(oldId, createdId);
      if (parentOld != null && Number.isFinite(parentOld)) {
        pendingParents.push({ newId: createdId, parentOld });
      }
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
