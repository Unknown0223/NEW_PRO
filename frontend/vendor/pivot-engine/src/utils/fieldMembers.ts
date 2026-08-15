/** Maydon uchun noyob qiymatlar ro'yxati (filtr UI uchun). */
export function getFieldMembers(
  data: Record<string, unknown>[],
  fieldId: string
): (string | number)[] {
  const seen = new Set<string>();
  const members: (string | number)[] = [];

  for (const row of data) {
    const raw = row[fieldId];
    if (raw == null || raw === "") continue;
    const key = String(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(typeof raw === "number" ? raw : key);
  }

  return members.sort((a, b) => String(a).localeCompare(String(b), "uz"));
}

type ExpandableRow = { key: string; children?: ExpandableRow[] };

/** Pivot jadvalidagi yoyiladigan qator kalitlari. */
export function collectExpandableRowKeys(rows: ExpandableRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    if (row.children?.length) {
      keys.push(row.key);
      keys.push(...collectExpandableRowKeys(row.children));
    }
  }
  return keys;
}
