import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export type ExportSheet = { sheetName: string; rows: string[][] };

export const C = {
  navy: "FF1E3A5F",
  teal: "FF0F766E",
  white: "FFFFFFFF",
  slate200: "FFE2E8F0",
  slate500: "FF64748B",
  blue: "FF2563EB",
  emerald: "FF059669",
  amber: "FFD97706",
  violet: "FF7C3AED"
} as const;

export const START_SHEET_TAB = "Инструкция";

export const STEP_TAB: Record<string, string> = {
  company: "Компания",
  territory: "Территория",
  units: "Единицы",
  currencies: "Валюты",
  "payment-methods": "Способ оплаты",
  "price-types": "Типы цен",
  "trade-directions": "Направление",
  "sales-channels": "Канал продаж",
  branches: "Филиалы",
  warehouses: "Склады",
  "client-formats": "Формат клиента",
  "client-types": "Тип клиента",
  "client-categories": "Категория клиента",
  "product-categories": "Категории продуктов",
  "products-catalog": "Продукты",
  "product-prices": "Цены",
  clients: "Клиенты",
  "work-slots": "Слоты",
  "stock-receipts": "Поступление"
};

export const EXPORT_ORDER = [
  "company",
  "territory",
  "units",
  "currencies",
  "payment-methods",
  "price-types",
  "trade-directions",
  "sales-channels",
  "branches",
  "warehouses",
  "client-formats",
  "client-types",
  "client-categories",
  "product-categories",
  "products-catalog",
  "product-prices",
  "clients",
  "work-slots",
  "stock-receipts"
] as const;

export const CLIENT_HEADERS = [
  "Наименование",
  "Юридическое название",
  "Адрес",
  "Телефон",
  "Контактное лицо",
  "Ориентир",
  "ИНН",
  "ПИНФЛ",
  "Торговый канал (код)",
  "Категория клиента (код)",
  "Тип клиента (код)",
  "Формат (код)",
  "Город (код)",
  "Широта",
  "Долгота"
] as const;

export const PRICE_HEADERS = ["Артикул (SKU)", "Тип цены", "Цена"] as const;

export const WORK_SLOT_HEADERS = [
  "slot_code",
  "label",
  "branch_code",
  "slot_type",
  "is_active",
  "sort_order",
  "assign_login"
] as const;

export function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

export function bufferToRows(buf: Buffer): string[][] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sn = wb.SheetNames[0];
  if (!sn) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn]!, {
    header: 1,
    defval: ""
  }) as unknown[][];
  return matrix
    .map((line) => (line ?? []).map((c) => String(c ?? "").trim()))
    .filter((line) => line.some((c) => c.length > 0));
}

export function sheetFromRefEntries(
  stepId: string,
  headers: string[],
  keys: string[],
  items: Array<Record<string, unknown>>
): ExportSheet | null {
  if (!items.length) return null;
  const rows = items.map((item) =>
    keys.map((k) => {
      if (k === "is_default") {
        const v = item[k];
        if (typeof v === "boolean") return v ? "1" : "0";
        return cellStr(v);
      }
      return cellStr(item[k]);
    })
  );
  return { sheetName: stepId, rows: [headers, ...rows] };
}

export function tabColorForStep(stepId: string): string {
  if (
    [
      "company",
      "territory",
      "units",
      "currencies",
      "payment-methods",
      "price-types",
      "trade-directions",
      "sales-channels",
      "branches",
      "warehouses"
    ].includes(stepId)
  ) {
    return C.blue;
  }
  if (["client-formats", "client-types", "client-categories"].includes(stepId)) {
    return C.emerald;
  }
  if (["product-categories", "products-catalog", "product-prices"].includes(stepId)) {
    return C.amber;
  }
  if (["clients", "work-slots", "stock-receipts"].includes(stepId)) {
    return C.violet;
  }
  return C.slate500;
}

export function uniqueTabName(existing: string[], base: string): string {
  let name = base.slice(0, 31);
  let n = 2;
  while (existing.includes(name)) {
    const suffix = ` ${n}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  return name;
}

export function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: C.white }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.teal } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: C.slate200 } },
    left: { style: "thin", color: { argb: C.slate200 } },
    bottom: { style: "thin", color: { argb: C.slate200 } },
    right: { style: "thin", color: { argb: C.slate200 } }
  };
}

export function applyDataStyle(cell: ExcelJS.Cell) {
  cell.font = { size: 10, color: { argb: "FF0F172A" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
  cell.border = {
    top: { style: "thin", color: { argb: C.slate200 } },
    left: { style: "thin", color: { argb: C.slate200 } },
    bottom: { style: "thin", color: { argb: C.slate200 } },
    right: { style: "thin", color: { argb: C.slate200 } }
  };
}
