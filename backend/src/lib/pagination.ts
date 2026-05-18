/**
 * Cursor-based pagination (keyset) — list API lar uchun.
 */

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
  hasNext: boolean;
};

export function encodeCursor(value: string | number | bigint): string {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined | null): string | null {
  if (!cursor?.trim()) return null;
  try {
    return Buffer.from(cursor.trim(), "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** `limit+1` usuli: ortiqcha yozuv keyingi sahifa borligini bildiradi. */
export function cursorPagination<T>(
  items: T[],
  getCursorValue: (item: T) => string | number | bigint,
  limit: number
): CursorPage<T> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const hasNext = items.length > safeLimit;
  const data = hasNext ? items.slice(0, safeLimit) : items;
  const last = data[data.length - 1];
  const nextCursor =
    hasNext && last != null ? encodeCursor(getCursorValue(last)) : null;
  return { data, nextCursor, hasNext };
}
