/** Ustun bo‘yicha barcha qatorlarda bir xil qiymat bo‘lsa — sarlavha uchun; aks holda `mixedValue`. */
export function commonBulkColumnValue<TItem, TValue>(
  items: readonly TItem[],
  read: (item: TItem) => TValue,
  mixedValue: TValue
): TValue {
  if (items.length === 0) return mixedValue;
  const first = read(items[0]!);
  for (let i = 1; i < items.length; i++) {
    if (read(items[i]!) !== first) return mixedValue;
  }
  return first;
}

export function commonBulkBooleanColumn<TItem>(
  items: readonly TItem[],
  read: (item: TItem) => boolean
): boolean | "mixed" {
  if (items.length === 0) return false;
  const first = read(items[0]!);
  for (let i = 1; i < items.length; i++) {
    if (read(items[i]!) !== first) return "mixed";
  }
  return first;
}
