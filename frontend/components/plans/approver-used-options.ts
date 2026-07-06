import type { EditableRow } from "./approver-table";

/** Tanlov ro'yxatidan allaqachon ishlatilgan id larni olib tashlaydi (joriy qiymat qoladi). */
export function filterSelectOptions<T extends { id: number }>(
  options: T[],
  currentValue: number | null,
  excludeIds: Iterable<number>
): T[] {
  const exclude = new Set(excludeIds);
  if (currentValue != null) exclude.delete(currentValue);
  return options.filter((o) => !exclude.has(o.id));
}

/** «Главный утверждающий» — boshqa rahbarlar va barcha «Степень» qiymatlari. */
export function usedLeaderExcludeIds(
  leaders: number[],
  rows: EditableRow[],
  leaderIndex: number
): number[] {
  const exclude = new Set<number>();
  for (const row of rows) {
    for (const v of row.levels) if (v != null) exclude.add(v);
  }
  leaders.forEach((id, i) => {
    if (i !== leaderIndex) exclude.add(id);
  });
  return [...exclude];
}

/** «Степень N» katagi — rahbarlar va boshqa kataklardagi xodimlar. */
export function usedLevelExcludeIds(
  leaders: number[],
  rows: EditableRow[],
  rowIdx: number,
  levelIdx: number
): number[] {
  const exclude = new Set<number>(leaders);
  rows.forEach((row, ri) => {
    row.levels.forEach((v, li) => {
      if (ri === rowIdx && li === levelIdx) return;
      if (v != null) exclude.add(v);
    });
  });
  return [...exclude];
}

/** Ustun sarlavhasi — boshqa ustunlar va rahbarlar. */
export function usedColumnHeaderExcludeIds(
  leaders: number[],
  rows: EditableRow[],
  levelIdx: number
): number[] {
  const exclude = new Set<number>(leaders);
  rows.forEach((row) => {
    row.levels.forEach((v, li) => {
      if (li === levelIdx) return;
      if (v != null) exclude.add(v);
    });
  });
  return [...exclude];
}

/** Yangi rahbar qo'shish uchun bo'sh nomzod bormi. */
export function hasUnusedLeaderOption(
  options: { id: number }[],
  leaders: number[],
  rows: EditableRow[]
): boolean {
  const used = new Set<number>(leaders);
  for (const row of rows) {
    for (const v of row.levels) if (v != null) used.add(v);
  }
  return options.some((o) => !used.has(o.id));
}
