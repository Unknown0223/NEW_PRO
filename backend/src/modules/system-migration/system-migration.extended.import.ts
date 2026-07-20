import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationConflictPolicy } from "./system-migration.constants";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import {
  EXTENDED_IMPORT_PHASES,
  type ExtendedTableSpec,
  type MapKey
} from "./system-migration.extended-specs";
import { importProductCategories } from "./system-migration.extended.import-categories";
import {
  ensureProductIdMap,
  fkSkipWarningUz,
  guessMissingFkFieldFromPrismaMessage,
  isPrismaMissingArgError,
  missingRequiredFk
} from "./system-migration.extended.import-fk";
import {
  createWithOptionalDuplicateSkip,
  delegateOf,
  omitForUpdate,
  pgErrorCode,
  prepareRow,
  prismaKnownCode
} from "./system-migration.extended.import-shared";
import { readZipJson } from "./system-migration.parse";

export { fkSkipWarningUz } from "./system-migration.extended.import-fk";

type Tx = Prisma.TransactionClient;

type ExtendedImportOpts = {
  strictFk?: boolean;
  skipDuplicateKeys?: boolean;
  conflictPolicy?: MigrationConflictPolicy;
};

async function resolveExistingId(
  model: ReturnType<typeof delegateOf>,
  tenantId: number,
  data: Record<string, unknown>,
  spec: ExtendedTableSpec
): Promise<number | null> {
  if (!spec.naturalKey?.length) return null;
  const findFirst = model.findFirst;
  if (typeof findFirst !== "function") return null;
  const where: Record<string, unknown> = {};
  if (spec.hasTenantId !== false) where.tenant_id = tenantId;
  for (const field of spec.naturalKey) {
    const value = data[field];
    if (value == null || value === "") return null;
    where[field] = value;
  }
  const existing = await findFirst({ where });
  return existing?.id ?? null;
}

async function importTableSpec(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  spec: ExtendedTableSpec,
  warnings: string[],
  strictFk: boolean,
  skipDuplicateKeys: boolean,
  conflictPolicy: MigrationConflictPolicy
): Promise<number> {
  if (spec.file === "product_categories") {
    return importProductCategories(
      tx,
      zip,
      tenantId,
      maps,
      warnings,
      skipDuplicateKeys,
      conflictPolicy
    );
  }

  const rows = await readZipJson<Record<string, unknown>>(zip, `data/${spec.file}.json`);
  if (!rows.length) return 0;

  const model = delegateOf(tx, spec.delegate);
  let imported = 0;
  let rowIdx = 0;
  let skippedDup = 0;
  const seenNoIdLinks = new Set<string>();

  for (const row of rows) {
    const data = prepareRow(row, spec, maps, tenantId, strictFk);
    rowIdx += 1;
    const sp = `mig_${spec.file.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24)}_${rowIdx}`;
    try {
      const missingFk = missingRequiredFk(data, spec);
      if (missingFk) {
        warnings.push(fkSkipWarningUz(spec.file, missingFk));
        continue;
      }
      if (spec.noId) {
        const linkKey = spec.fk
          ? Object.keys(spec.fk)
              .sort()
              .map((f) => `${f}=${String(data[f] ?? "")}`)
              .join("&")
          : "";
        if (skipDuplicateKeys && linkKey) {
          if (seenNoIdLinks.has(linkKey)) {
            skippedDup += 1;
            continue;
          }
          if (typeof model.findFirst === "function") {
            const where: Record<string, unknown> = {};
            for (const field of Object.keys(spec.fk!)) {
              where[field] = data[field];
            }
            const existing = await model.findFirst({ where });
            if (existing) {
              seenNoIdLinks.add(linkKey);
              skippedDup += 1;
              continue;
            }
          }
        }
        const outcome = await createWithOptionalDuplicateSkip(
          tx,
          async () => {
            const createData: Record<string, unknown> = {};
            if (spec.fk) {
              for (const field of Object.keys(spec.fk)) {
                createData[field] = data[field];
              }
            }
            for (const [k, v] of Object.entries(data)) {
              if (k === "id" || k === "tenant_id") continue;
              if (createData[k] === undefined) createData[k] = v;
            }
            await model.create({ data: createData });
          },
          { skipDuplicateKeys, savepoint: sp }
        );
        if (outcome === "skipped") {
          if (linkKey) seenNoIdLinks.add(linkKey);
          skippedDup += 1;
          continue;
        }
        if (linkKey) seenNoIdLinks.add(linkKey);
        imported += 1;
        continue;
      }
      const oldId = Number(row.id);
      if (spec.idMap && spec.naturalKey?.length) {
        const existingId = await resolveExistingId(model, tenantId, data, spec);
        if (existingId != null) {
          maps[spec.idMap].set(oldId, existingId);
          if (conflictPolicy === "replace") {
            await model.update({
              where: { id: existingId },
              data: omitForUpdate(data)
            });
            imported += 1;
          } else {
            skippedDup += 1;
          }
          continue;
        }
      }
      let createdId: number | null = null;
      const outcome = await createWithOptionalDuplicateSkip(
        tx,
        async () => {
          const created = await model.create({ data });
          createdId = created.id;
          return created;
        },
        { skipDuplicateKeys, savepoint: sp }
      );
      if (outcome === "skipped") {
        const existingId = await resolveExistingId(model, tenantId, data, spec);
        if (existingId != null && spec.idMap) {
          maps[spec.idMap].set(oldId, existingId);
          if (conflictPolicy === "replace") {
            await model.update({
              where: { id: existingId },
              data: omitForUpdate(data)
            });
            imported += 1;
          } else {
            skippedDup += 1;
          }
        } else {
          skippedDup += 1;
        }
        continue;
      }
      if (spec.idMap && createdId != null) maps[spec.idMap].set(oldId, createdId);
      imported += 1;
    } catch (e) {
      if (
        prismaKnownCode(e) === "P2021" ||
        prismaKnownCode(e) === "P2022" ||
        pgErrorCode(e) === "42P01"
      ) {
        warnings.push(`${spec.file}: jadval/ustun yo‘q — o‘tkazib yuborildi.`);
        return imported;
      }
      if (isPrismaMissingArgError(e)) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(fkSkipWarningUz(spec.file, guessMissingFkFieldFromPrismaMessage(msg)));
        continue;
      }
      throw e;
    }
  }

  if (skippedDup > 0) {
    warnings.push(
      `${spec.file}: ${skippedDup} qator dublikat kalit bilan o‘tkazib yuborildi.`
    );
  }

  return imported;
}

export async function importExtendedPhases(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps,
  phaseIndexes: number[],
  warnings: string[],
  opts?: ExtendedImportOpts
): Promise<Record<string, number>> {
  const strictFk = opts?.strictFk ?? true;
  const skipDuplicateKeys = opts?.skipDuplicateKeys ?? false;
  const conflictPolicy: MigrationConflictPolicy =
    opts?.conflictPolicy === "replace" ? "replace" : "keep";
  const counts: Record<string, number> = {};

  const needsProductMap = phaseIndexes.some((idx) =>
    (EXTENDED_IMPORT_PHASES[idx] ?? []).some(
      (s) => s.fk && Object.values(s.fk).includes("product" as MapKey)
    )
  );
  if (needsProductMap) {
    await ensureProductIdMap(tx, zip, tenantId, maps);
  }

  for (const phaseIdx of phaseIndexes) {
    const phase = EXTENDED_IMPORT_PHASES[phaseIdx];
    if (!phase) continue;
    for (const spec of phase) {
      counts[spec.file] = await importTableSpec(
        tx,
        zip,
        tenantId,
        maps,
        spec,
        warnings,
        strictFk,
        skipDuplicateKeys,
        conflictPolicy
      );
    }
  }

  return counts;
}
