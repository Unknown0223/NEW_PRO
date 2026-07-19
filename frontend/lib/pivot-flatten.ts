import type { PivotRow, PivotTotalRow } from "@salec/pivot-engine";
import { GROUP_KEY_SEPARATOR, splitGroupKey } from "@salec/pivot-engine";

/** PivotEngine measure-child marker (`PivotEngine` MEASURE_ROW_MARKER). */
const MEASURE_ROW_MARKER = "__v__";

/** WDR «Measures in Rows»: metrika qatorlari doim ko‘rinadi (expand talab qilinmaydi). */
function rowHasMeasureChildren(row: PivotRow): boolean {
  return Boolean(row.children?.some((c) => c.key.includes(MEASURE_ROW_MARKER)));
}

export type LocalFlatPivotRowItem =
  | {
      type: "row";
      row: PivotRow;
      depth: number;
      expanded: boolean;
      hasChildren: boolean;
      rowKey: string;
      pathLabels: string[];
    }
  | { type: "subtotal"; subtotal: PivotTotalRow; depth: number; parentKey: string; pathLabels?: string[] }
  | { type: "columnTotal"; total: PivotTotalRow }
  | { type: "grandTotal"; total: PivotTotalRow };

/** Qator kalitini darajalarga ajratadi (` | `, eski ` > `, aralash ham). */
export function splitPivotRowPath(key: string): string[] {
  const chunks = key.includes(GROUP_KEY_SEPARATOR) ? splitGroupKey(key) : [key];
  const parts: string[] = [];
  for (const chunk of chunks) {
    if (chunk.includes(" > ")) {
      for (const p of chunk.split(" > ")) {
        const t = p.trim();
        if (t) parts.push(t);
      }
    } else {
      const t = chunk.trim();
      if (t) parts.push(t);
    }
  }
  return parts;
}

/** Classic/ustun prefiks kaliti: labels[0..colIdx] → `A | B`. */
export function classicPathPrefixKey(labels: string[], colIdx: number): string | null {
  if (colIdx < 0 || colIdx >= labels.length) return null;
  const parts: string[] = [];
  for (let i = 0; i <= colIdx; i++) {
    const t = labels[i]?.trim() ?? "";
    if (!t) return null;
    parts.push(t);
  }
  return parts.join(GROUP_KEY_SEPARATOR);
}

/**
 * Klassik ko‘rinish (Excel/WDR): chapdan bir xil ota yorliqlari keyingi qatorda bo‘sh.
 * Oxirgi (joriy a’zo) yorliq HECH QACHON blank qilinmaydi.
 */
export function blankRepeatedParentLabels(
  current: string[],
  previous: string[] | null | undefined
): string[] {
  if (!previous?.length) return [...current];
  const out: string[] = [];
  let stillSame = true;
  const lastIdx = current.length - 1;
  for (let i = 0; i < current.length; i++) {
    const cur = current[i] ?? "";
    const prev = previous[i] ?? "";
    // Self (oxirgi daraja) — har doim ko‘rinadi
    if (i === lastIdx) {
      out.push(cur);
      continue;
    }
    if (stillSame && cur !== "" && cur === prev) {
      out.push("");
    } else {
      stillSame = false;
      out.push(cur);
    }
  }
  return out;
}

function rowLabel(row: PivotRow): string {
  const labelCell = row.cells.find((c) => c.columnKey === "__row_label__") ?? row.cells[0];
  const raw = labelCell?.formatted ?? labelCell?.value;
  if (raw != null && String(raw).trim() !== "") return String(raw);
  const parts = splitPivotRowPath(row.key);
  return parts[parts.length - 1] ?? row.key;
}

/**
 * Classic path: to‘liq yo‘l (ota + self) — expand/kalit uchun.
 * Ekranda takroriy otalarni `blankRepeatedParentLabels` bilan yashirish mumkin.
 */
export function buildClassicPathLabels(row: PivotRow, ancestors: string[], rowFieldCount: number): string[] {
  const self = rowLabel(row);
  const fromKey = splitPivotRowPath(row.key);

  // Walk: har daraja mustaqil — ota labels dan + joriy self (dublikat normal)
  let path = ancestors.length > 0 ? [...ancestors, self] : [self];

  // To‘liq hierarchical key — bo‘sh/yetishmagan qismlarni to‘ldirish
  if (fromKey.length >= path.length) {
    path = [...fromKey];
  } else if (fromKey.length > 1) {
    path = path.map((part, i) => {
      const k = fromKey[i];
      return part.trim() !== "" ? part : k && k.trim() !== "" ? k : part;
    });
  }

  if (rowFieldCount > 0 && path.length > rowFieldCount) {
    path = path.slice(0, rowFieldCount);
  }
  return path;
}

/**
 * Compact / Classic display flatten.
 *
 * Compact (tree + multi-column):
 * - Ota qatori har doim ko‘rinadi; ochilganda bolalar ostida
 * - Har row field — alohida ustun (pathLabels, ota yorliqlari takrorlanadi)
 *
 * Classic:
 * - Har guruh — alohida ustun
 * - Ochilganda ota pastga tushmaydi; har bola — yangi qator
 * - pathLabels to‘liq (kalit); UI da `blankRepeatedParentLabels` — ota dublikatlari blank
 */
export function flattenPivotRowsLocal(
  rows: PivotRow[],
  expandedRows: Set<string>,
  grandTotal?: PivotTotalRow,
  columnTotals?: PivotTotalRow,
  mode: "compact" | "classic" = "compact",
  rowFieldCount = 0
): LocalFlatPivotRowItem[] {
  const result: LocalFlatPivotRowItem[] = [];
  const dimCount = rowFieldCount > 0 ? rowFieldCount : 0;

  function walkCompact(row: PivotRow, ancestors: string[], depth: number) {
    const hasChildren = Boolean(row.children?.length);
    const expanded = expandedRows.has(row.key) || rowHasMeasureChildren(row);
    const pathLabels = buildClassicPathLabels(row, ancestors, dimCount || ancestors.length + 1);
    const childAncestors = pathLabels;
    result.push({
      type: "row",
      row,
      depth,
      expanded,
      hasChildren,
      rowKey: row.key,
      pathLabels
    });
    if (expanded && hasChildren) {
      for (const child of row.children!) walkCompact(child, childAncestors, depth + 1);
      if (row.subtotal) {
        result.push({
          type: "subtotal",
          subtotal: row.subtotal,
          depth,
          parentKey: row.key,
          pathLabels
        });
      }
    }
  }

  function walkClassic(row: PivotRow, ancestors: string[], depth: number) {
    const hasChildren = Boolean(row.children?.length);
    const expanded = expandedRows.has(row.key) || rowHasMeasureChildren(row);
    // Walk asosiy: […ota, self] — sibling lar ota yorlig‘ini MUSTAQIL takrorlaydi
    const pathLabels = buildClassicPathLabels(row, ancestors, dimCount || ancestors.length + 1);
    // Bolalarga faqat ota yo‘li (self oxirida) — keyin bola o‘z self ini qo‘shadi
    const childAncestors = pathLabels;

    if (expanded && hasChildren) {
      for (const child of row.children!) {
        walkClassic(child, childAncestors, depth + 1);
      }
      if (row.subtotal) {
        result.push({
          type: "subtotal",
          subtotal: row.subtotal,
          depth,
          parentKey: row.key,
          pathLabels
        });
      }
      return;
    }

    result.push({
      type: "row",
      row,
      depth,
      expanded,
      hasChildren,
      rowKey: row.key,
      pathLabels
    });
  }

  if (mode === "classic") {
    for (const row of rows) walkClassic(row, [], 0);
  } else {
    for (const row of rows) walkCompact(row, [], 0);
  }

  if (columnTotals) result.push({ type: "columnTotal", total: columnTotals });
  if (grandTotal) result.push({ type: "grandTotal", total: grandTotal });
  return result;
}
