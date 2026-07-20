import type { Prisma } from "@prisma/client";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import type { ExtendedTableSpec, MapKey } from "./system-migration.extended-specs";
import {
  hydrateDates,
  hydrateDecimals,
  remapId,
  remapIntArray,
  stripIdTenant
} from "./system-migration.parse";

export type Tx = Prisma.TransactionClient;

export function omitForUpdate(data: Record<string, unknown>): Record<string, unknown> {
  const { tenant_id: _t, id: _id, ...rest } = data;
  return rest;
}

function prismaCode(e: unknown): string {
  return e !== null && typeof e === "object" && "code" in e
    ? String((e as { code?: unknown }).code ?? "")
    : "";
}

export function pgErrorCode(e: unknown): string {
  const code = prismaCode(e);
  if (code) return code;
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/code:\s*"([A-Z0-9]+)"/);
  return m?.[1] ?? "";
}

export function prismaKnownCode(e: unknown): string {
  return prismaCode(e);
}

function isDuplicateOrSkipableError(e: unknown): boolean {
  const c = pgErrorCode(e);
  return c === "P2002" || c === "23505";
}

function isAbortedTxError(e: unknown): boolean {
  return pgErrorCode(e) === "25P02" || /current transaction is aborted/i.test(String(e));
}

/**
 * Postgres: tranzaksiyada bitta XATO → butun TX abort (25P02).
 * Dublikatni yutish uchun har bir create SAVEPOINT ichida.
 */
export async function createWithOptionalDuplicateSkip(
  tx: Tx,
  run: () => Promise<{ id: number } | void>,
  opts: { skipDuplicateKeys: boolean; savepoint: string }
): Promise<"created" | "skipped"> {
  if (!opts.skipDuplicateKeys) {
    await run();
    return "created";
  }
  await tx.$executeRawUnsafe(`SAVEPOINT ${opts.savepoint}`);
  try {
    await run();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${opts.savepoint}`);
    return "created";
  } catch (e) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${opts.savepoint}`);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${opts.savepoint}`);
    if (isDuplicateOrSkipableError(e)) return "skipped";
    if (isAbortedTxError(e)) return "skipped";
    throw e;
  }
}

export function delegateOf(tx: Tx, name: string): {
  create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }>;
  update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>;
  findFirst?: (args: { where: Record<string, unknown> }) => Promise<{ id: number } | null>;
} {
  return (tx as Record<string, unknown>)[name] as ReturnType<typeof delegateOf>;
}

export function prepareRow(
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
