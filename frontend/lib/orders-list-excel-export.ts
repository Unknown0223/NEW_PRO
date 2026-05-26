import type { OrderDetailRow, OrderItemRow, OrderListRow } from "@/components/orders/order-detail-view";
import { api } from "@/lib/api";
import { downloadStyledXlsxSheet } from "@/lib/download-xlsx-styled";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { ORDER_LIST_COLUMNS, orderListExportCell } from "@/lib/orders-list-columns";

export type OrdersExcelExportMode = "simple" | "detailed";

const PRODUCT_HEADERS = [
  "Тип",
  "Ассортимент",
  "Цена",
  "Блок",
  "Кол-во",
  "Объем",
  "Скидка",
  "Общая"
] as const;

function parseNum(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  return Number.parseFloat(String(s).replace(/\s/g, "").replace(",", ".")) || 0;
}

function blockFromQty(qty: number): number {
  if (qty <= 0) return 0;
  return Math.ceil(qty / 4);
}

function sortOrderThenBonus(items: OrderItemRow[]): OrderItemRow[] {
  const paid = items.filter((i) => !i.is_bonus).sort((a, b) => a.id - b.id);
  const bonus = items.filter((i) => i.is_bonus).sort((a, b) => a.id - b.id);
  return [...paid, ...bonus];
}

function productExportCells(item: OrderItemRow): string[] {
  const qty = parseNum(item.qty);
  const price = parseNum(item.price);
  const vol = parseNum(item.line_volume_m3 ?? item.volume_m3);
  const disc = item.is_bonus ? "" : item.discount_pct?.trim() ? `${item.discount_pct}%` : "0 %";
  const lineTotal = item.is_bonus ? 0 : parseNum(item.total);
  return [
    item.is_bonus ? "Бонус" : "Заказ",
    item.name,
    formatNumberGrouped(price, { maxFractionDigits: 2 }),
    item.is_bonus ? "" : String(blockFromQty(qty)),
    formatNumberGrouped(qty, { maxFractionDigits: 3 }),
    item.is_bonus ? "0" : vol > 0 ? formatNumberGrouped(vol, { maxFractionDigits: 4 }) : "0",
    disc,
    formatNumberGrouped(lineTotal, { maxFractionDigits: 2 })
  ];
}

function orderExportCells(o: OrderListRow, visibleColumnOrder: string[]): string[] {
  return visibleColumnOrder.map((colId) => orderListExportCell(o, colId));
}

function emptyCells(n: number): string[] {
  return Array.from({ length: n }, () => "");
}

export function buildOrdersExcelHeaders(visibleColumnOrder: string[]): string[] {
  const orderHeaders = visibleColumnOrder.map(
    (id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id
  );
  return [...orderHeaders, ...PRODUCT_HEADERS];
}

export function buildOrdersExcelSimpleRows(
  orders: OrderListRow[],
  visibleColumnOrder: string[],
  detailsById: Map<number, OrderDetailRow>
): string[][] {
  const out: string[][] = [];

  for (const o of orders) {
    const detail = detailsById.get(o.id);
    const items = sortOrderThenBonus(detail?.items ?? []);
    if (items.length === 0) {
      out.push([...orderExportCells(o, visibleColumnOrder), ...emptyCells(PRODUCT_HEADERS.length)]);
      continue;
    }
    for (const item of items) {
      out.push([...orderExportCells(o, visibleColumnOrder), ...productExportCells(item)]);
    }
  }

  return out;
}

/** Zakaz qatori, keyin uning mahsulotlari (surilgan ko‘rinish). */
export function buildOrdersExcelDetailedRows(
  orders: OrderListRow[],
  visibleColumnOrder: string[],
  detailsById: Map<number, OrderDetailRow>
): string[][] {
  const out: string[][] = [];
  const productEmpty = emptyCells(PRODUCT_HEADERS.length);

  for (const o of orders) {
    const detail = detailsById.get(o.id);
    const items = sortOrderThenBonus(detail?.items ?? []);

    out.push([...orderExportCells(o, visibleColumnOrder), ...productEmpty]);

    if (items.length === 0) {
      out.push([
        ...orderExportCells(o, visibleColumnOrder),
        "—",
        "Нет строк товаров",
        ...emptyCells(PRODUCT_HEADERS.length - 2)
      ]);
      continue;
    }

    for (const item of items) {
      out.push([...orderExportCells(o, visibleColumnOrder), ...productExportCells(item)]);
    }
  }

  return out;
}

export async function fetchOrderDetailsForExport(
  tenantSlug: string,
  orders: OrderListRow[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<number, OrderDetailRow>> {
  const map = new Map<number, OrderDetailRow>();
  const ids = orders.map((o) => o.id);
  const total = ids.length;
  const batchSize = 8;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (id) => {
        const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${id}`);
        map.set(id, data);
      })
    );
    onProgress?.(Math.min(i + batch.length, total), total);
  }

  return map;
}

export async function downloadOrdersListExcel(args: {
  mode: OrdersExcelExportMode;
  tenantSlug: string;
  orders: OrderListRow[];
  visibleColumnOrder: string[];
  onProgress?: (done: number, total: number) => void;
}): Promise<void> {
  const { mode, tenantSlug, orders, visibleColumnOrder, onProgress } = args;
  const detailsById = await fetchOrderDetailsForExport(tenantSlug, orders, onProgress);
  const headers = buildOrdersExcelHeaders(visibleColumnOrder);
  const dataRows =
    mode === "simple"
      ? buildOrdersExcelSimpleRows(orders, visibleColumnOrder, detailsById)
      : buildOrdersExcelDetailedRows(orders, visibleColumnOrder, detailsById);

  const typeColIdx = visibleColumnOrder.length;
  const rowMeta = dataRows.map((row) => ({
    isBonusRow: row[typeColIdx] === "Бонус"
  }));

  const date = new Date().toISOString().slice(0, 10);
  const suffix = mode === "simple" ? "oddiy" : "detalniy";
  await downloadStyledXlsxSheet(`zakazlar_${suffix}_${date}.xlsx`, "Zakazlar", headers, dataRows, {
    rowMeta
  });
}
