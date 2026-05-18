const CODE_MAX = 20;

export function salesRefStoredValue(row: { code: string | null; name: string }): string {
  const c = row.code?.trim();
  if (c) return c;
  return row.name.trim();
}

export function normCode(raw: string | null | undefined): string | null {
  const t = raw?.trim().slice(0, CODE_MAX) ?? "";
  return t ? t : null;
}

export function sortRu(a: string, b: string): number {
  return a.localeCompare(b, "ru");
}
