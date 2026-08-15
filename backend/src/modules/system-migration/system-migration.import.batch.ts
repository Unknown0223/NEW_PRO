/** Migratsiya import: qator-qator create o‘rniga createMany / createManyAndReturn. */

export const MIGRATION_CREATE_CHUNK = 400;

export function chunkArray<T>(items: T[], size = MIGRATION_CREATE_CHUNK): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Leaf jadvallar: ID remap kerak emas. */
export async function createManyChunked<T>(
  createMany: (args: { data: T[] }) => Promise<unknown>,
  rows: T[]
): Promise<number> {
  if (rows.length === 0) return 0;
  let n = 0;
  for (const chunk of chunkArray(rows)) {
    await createMany({ data: chunk });
    n += chunk.length;
  }
  return n;
}

/**
 * Ota yozuvlar: createManyAndReturn + indeks bo‘yicha old→new map.
 * PostgreSQL multi-row INSERT RETURNING tartibi saqlanadi; length mismatch — xato.
 */
export async function createManyAndMapIds<TData>(
  createManyAndReturn: (args: {
    data: TData[];
    select: { id: true };
  }) => Promise<Array<{ id: number }>>,
  rows: Array<{ oldId: number; data: TData }>,
  idMap: Map<number, number>
): Promise<number> {
  if (rows.length === 0) return 0;
  for (const chunk of chunkArray(rows)) {
    const created = await createManyAndReturn({
      data: chunk.map((r) => r.data),
      select: { id: true }
    });
    if (created.length !== chunk.length) {
      throw new Error(
        `BATCH_CREATE_COUNT_MISMATCH: expected ${chunk.length}, got ${created.length}`
      );
    }
    for (let i = 0; i < chunk.length; i++) {
      idMap.set(chunk[i]!.oldId, created[i]!.id);
    }
  }
  return rows.length;
}

/** Unique business key (masalan order.number) orqali ishonchli remap. */
export async function createManyAndMapByKey<TData, TKey extends string | number>(
  createManyAndReturn: (args: {
    data: TData[];
    select: { id: true; number: true };
  }) => Promise<Array<{ id: number; number: string }>>,
  rows: Array<{ oldId: number; key: TKey; data: TData }>,
  idMap: Map<number, number>
): Promise<number> {
  if (rows.length === 0) return 0;
  for (const chunk of chunkArray(rows)) {
    const created = await createManyAndReturn({
      data: chunk.map((r) => r.data),
      select: { id: true, number: true }
    });
    const byKey = new Map<string, number>();
    for (const row of created) {
      byKey.set(String(row.number), row.id);
    }
    for (const item of chunk) {
      const newId = byKey.get(String(item.key));
      if (newId == null) {
        throw new Error(`BATCH_CREATE_KEY_MISSING:number:${String(item.key)}`);
      }
      idMap.set(item.oldId, newId);
    }
  }
  return rows.length;
}
