import type { BulkExportCategoryId } from "@/lib/bulk-export-templates";
import type { NakladnoyGroupBy } from "@/lib/order-nakladnoy";

/** Varaq nomidan guruh kaliti (dostavchik / agent / hudud). */
export function normalizeSheetGroupKey(sheetName: string): string {
  let s = sheetName.trim();
  const sep = s.indexOf(" - ");
  if (sep > 0) s = s.slice(sep + 3).trim();
  s = s.replace(/_\d+$/, "").trim();
  return s.toLowerCase();
}

export function isGroupInterleaveCategory(category: BulkExportCategoryId): boolean {
  return category === "expeditor" || category === "invoices";
}

export function shouldInterleaveBulkSheetsByGroup(
  sources: Array<{ category: BulkExportCategoryId; separateSheets: boolean }>
): boolean {
  const grouped = sources.filter(
    (s) => isGroupInterleaveCategory(s.category) && s.separateSheets
  );
  return grouped.length >= 2;
}

/** Guruh tartibi: birinchi shablondagi varaqlar, keyin qolganlari. */
export function collectGroupKeysInOrder(
  sheetNamesByTemplate: string[][],
  primaryIndex = 0
): string[] {
  const keys: string[] = [];
  const add = (names: string[]) => {
    for (const name of names) {
      const k = normalizeSheetGroupKey(name);
      if (k && !keys.includes(k)) keys.push(k);
    }
  };
  const order = [
    primaryIndex,
    ...sheetNamesByTemplate.map((_, i) => i).filter((i) => i !== primaryIndex)
  ];
  for (const i of order) {
    add(sheetNamesByTemplate[i] ?? []);
  }
  return keys;
}

export function groupByLabel(groupBy: NakladnoyGroupBy): string {
  switch (groupBy) {
    case "expeditor":
      return "экспедитор";
    case "territory":
      return "территория";
    case "agent":
    default:
      return "агент";
  }
}
