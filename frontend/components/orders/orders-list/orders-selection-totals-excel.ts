import type { OrderItemRow } from "@/components/orders/order-detail-view";
import { downloadStyledXlsxSheet } from "@/lib/download-xlsx-styled";
import { formatNumberGrouped } from "@/lib/format-numbers";
import {
  blockFromQty,
  computeItemTotals,
  groupItemsByCategory,
  lineTypeLabel,
  parseOrderItemNum
} from "./order-items-grouping";

const HEADERS = [
  "Категория товар",
  "Ассортимент",
  "Тип",
  "Цена",
  "Блок",
  "Кол-во",
  "Объем",
  "Скидка",
  "Общая"
] as const;

function lineToExcelRow(categoryName: string, p: OrderItemRow): (string | number)[] {
  const qty = parseOrderItemNum(p.qty);
  const price = parseOrderItemNum(p.price);
  const vol = parseOrderItemNum(p.line_volume_m3 ?? p.volume_m3);
  const disc = p.is_bonus ? "—" : p.discount_pct?.trim() ? `${p.discount_pct}%` : "0 %";
  const lineTotal = p.is_bonus ? 0 : parseOrderItemNum(p.total);
  return [
    categoryName,
    p.name,
    lineTypeLabel(p),
    p.is_bonus ? "—" : formatNumberGrouped(price, { maxFractionDigits: 2 }),
    p.is_bonus ? "—" : blockFromQty(qty),
    formatNumberGrouped(qty, { maxFractionDigits: 3 }),
    p.is_bonus ? 0 : vol > 0 ? formatNumberGrouped(vol, { maxFractionDigits: 4 }) : 0,
    disc,
    p.is_bonus ? "—" : formatNumberGrouped(lineTotal, { maxFractionDigits: 2 })
  ];
}

export async function downloadSelectionTotalsExcel(
  items: OrderItemRow[],
  orderCount: number
): Promise<void> {
  const groups = groupItemsByCategory(items);
  const dataRows: (string | number)[][] = [];
  const rowMeta: { isBonusRow?: boolean }[] = [];

  for (const g of groups) {
    for (const p of g.items) {
      dataRows.push(lineToExcelRow(g.name, p));
      rowMeta.push({ isBonusRow: p.is_bonus });
    }
  }

  const totals = computeItemTotals(items);
  const qtyCell =
    totals.bonusQty > 0
      ? `${formatNumberGrouped(totals.qty, { maxFractionDigits: 3 })}\nбонус ${formatNumberGrouped(totals.bonusQty, { maxFractionDigits: 3 })}`
      : formatNumberGrouped(totals.qty, { maxFractionDigits: 3 });

  dataRows.push([
    "",
    "Итого",
    "",
    "",
    totals.blocks,
    qtyCell,
    totals.volume > 0 ? formatNumberGrouped(totals.volume, { maxFractionDigits: 4 }) : 0,
    "",
    formatNumberGrouped(totals.sum, { maxFractionDigits: 2 })
  ]);
  rowMeta.push({});

  const date = new Date().toISOString().slice(0, 10);
  await downloadStyledXlsxSheet(
    `itog_zakazlar_${orderCount}_${date}.xlsx`,
    "Итог",
    [...HEADERS],
    dataRows,
    { rowMeta }
  );
}
