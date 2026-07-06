import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { listClientsForTenantPaged } from "../clients/clients.list";
import { exportTenantCatalogProductsXlsx } from "../products/products.import.catalog";
import { listPricesMatrixForCategories } from "../products/product-prices.read";
import { listSalesChannelRefs } from "../sales-directions/sales-directions.channels";
import { listTradeDirections } from "../sales-directions/sales-directions.trade";
import { getTenantProfile } from "./tenant-settings.service";
import { getTenantDefaultCurrencyCode } from "./tenant-settings.profile.read";
import type { BranchDto, UnitMeasureDto } from "./tenant-settings.types";
import type { CurrencyEntryDto, PaymentMethodEntryDto, PriceTypeEntryDto } from "./finance-refs";

type ExportSheet = { sheetName: string; rows: string[][] };

const C = {
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

const START_SHEET_TAB = "Инструкция";

const STEP_TAB: Record<string, string> = {
  company: "Компания",
  units: "Единицы",
  currencies: "Валюты",
  "payment-methods": "Способ оплаты",
  "price-types": "Типы цен",
  "trade-directions": "Направление",
  "sales-channels": "Канал продаж",
  branches: "Филиалы",
  "client-formats": "Формат клиента",
  "client-types": "Тип клиента",
  "client-categories": "Категория клиента",
  "products-catalog": "Продукты",
  "product-prices": "Цены",
  clients: "Клиенты",
  "work-slots": "Слоты",
  "stock-receipts": "Поступление"
};

const EXPORT_ORDER = [
  "company",
  "units",
  "currencies",
  "payment-methods",
  "price-types",
  "trade-directions",
  "sales-channels",
  "branches",
  "client-formats",
  "client-types",
  "client-categories",
  "products-catalog",
  "product-prices",
  "clients",
  "work-slots",
  "stock-receipts"
] as const;

const CLIENT_HEADERS = [
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

const PRICE_HEADERS = ["Артикул (SKU)", "Тип цены", "Цена"] as const;

const WORK_SLOT_HEADERS = [
  "slot_code",
  "label",
  "branch_code",
  "slot_type",
  "is_active",
  "sort_order",
  "assign_login"
] as const;

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

function bufferToRows(buf: Buffer): string[][] {
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

function sheetFromRefEntries(
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

function tabColorForStep(stepId: string): string {
  if (
    [
      "company",
      "units",
      "currencies",
      "payment-methods",
      "price-types",
      "trade-directions",
      "sales-channels",
      "branches"
    ].includes(stepId)
  ) {
    return C.blue;
  }
  if (["client-formats", "client-types", "client-categories"].includes(stepId)) {
    return C.emerald;
  }
  if (["products-catalog", "product-prices"].includes(stepId)) {
    return C.amber;
  }
  if (["clients", "work-slots", "stock-receipts"].includes(stepId)) {
    return C.violet;
  }
  return C.slate500;
}

function uniqueTabName(existing: string[], base: string): string {
  let name = base.slice(0, 31);
  let n = 2;
  while (existing.includes(name)) {
    const suffix = ` ${n}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  return name;
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
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

function applyDataStyle(cell: ExcelJS.Cell) {
  cell.font = { size: 10, color: { argb: "FF0F172A" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
  cell.border = {
    top: { style: "thin", color: { argb: C.slate200 } },
    left: { style: "thin", color: { argb: C.slate200 } },
    bottom: { style: "thin", color: { argb: C.slate200 } },
    right: { style: "thin", color: { argb: C.slate200 } }
  };
}

async function addStartSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet(START_SHEET_TAB, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: C.navy } }
  });

  ws.mergeCells("A1:F1");
  const t = ws.getCell("A1");
  t.value = "Начальная настройка";
  t.font = { bold: true, size: 16, color: { argb: C.white } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } };
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  const lines = [
    "Каждый лист — отдельный раздел. Не переименовывайте вкладки.",
    "Порядок: Основа → Справочники клиента → Продукты → Клиенты",
    "Зелёная строка — заголовки. Серый курсив — пример (можно удалить или заменить своими данными).",
    "Неизменённые примеры при загрузке игнорируются — в систему не попадают.",
    "Звёздочка (*) в заголовке — обязательное поле."
  ];

  let row = 3;
  for (const text of lines) {
    ws.mergeCells(`A${row}:F${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = { size: 11 };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(row).height = 22;
    row++;
  }

  row += 1;
  ws.getCell(`A${row}`).value = "Группы листов";
  ws.getCell(`A${row}`).font = { bold: true, size: 11 };
  row++;

  const legend: [string, string][] = [
    ["Основа (синий)", "Компания, Единицы, Валюты, Филиалы…"],
    ["Справочники клиента (зелёный)", "Формат, Тип, Категория клиента"],
    ["Продукты (жёлтый)", "Продукты, Цены"],
    ["Операции (фиолетовый)", "Клиенты, Слоты, Поступление"]
  ];
  for (const [g, ex] of legend) {
    ws.getCell(`A${row}`).value = g;
    ws.getCell(`B${row}`).value = ex;
    ws.getCell(`A${row}`).font = { bold: true, size: 10 };
    row++;
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 42;
}

function addDataSheet(wb: ExcelJS.Workbook, sheet: ExportSheet) {
  const tab = uniqueTabName(
    wb.worksheets.map((w) => w.name),
    (STEP_TAB[sheet.sheetName] ?? sheet.sheetName).slice(0, 31)
  );
  const ws = wb.addWorksheet(tab, {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: tabColorForStep(sheet.sheetName) } }
  });
  if (!sheet.rows.length) return;

  const [header, ...dataRows] = sheet.rows;
  const headerRow = ws.getRow(1);
  header.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    applyHeaderStyle(cell);
  });
  headerRow.height = 24;

  dataRows.forEach((line, ri) => {
    const row = ws.getRow(ri + 2);
    line.forEach((text, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = text ?? "";
      applyDataStyle(cell);
    });
    row.height = 20;
  });

  header.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(32, Math.max(12, h.length + 4));
  });
}

async function collectExportSheets(tenantId: number): Promise<ExportSheet[]> {
  const byId = new Map<string, ExportSheet>();
  const profile = await getTenantProfile(tenantId);
  const refs = profile.references ?? {};

  if (profile.name?.trim()) {
    byId.set("company", {
      sheetName: "company",
      rows: [
        ["Название организации", "Телефон", "Адрес"],
        [profile.name, profile.phone ?? "", profile.address ?? ""]
      ]
    });
  }

  const units = (refs.unit_measures as UnitMeasureDto[] | undefined) ?? [];
  const unitsSheet = sheetFromRefEntries(
    "units",
    ["Название", "Код", "Заголовок", "Сортировка"],
    ["name", "code", "title", "sort_order"],
    units as unknown as Record<string, unknown>[]
  );
  if (unitsSheet) byId.set("units", unitsSheet);

  const currencies = (refs.currency_entries as CurrencyEntryDto[] | undefined) ?? [];
  const curSheet = sheetFromRefEntries(
    "currencies",
    ["Название", "Код", "По умолчанию (1/0)", "Сортировка"],
    ["name", "code", "is_default", "sort_order"],
    currencies as unknown as Record<string, unknown>[]
  );
  if (curSheet) byId.set("currencies", curSheet);

  const payMethods = (refs.payment_method_entries as PaymentMethodEntryDto[] | undefined) ?? [];
  const paySheet = sheetFromRefEntries(
    "payment-methods",
    ["Название", "Код", "Валюта (код)", "Сортировка"],
    ["name", "code", "currency_code", "sort_order"],
    payMethods as unknown as Record<string, unknown>[]
  );
  if (paySheet) byId.set("payment-methods", paySheet);

  const priceTypes = (refs.price_type_entries as PriceTypeEntryDto[] | undefined) ?? [];
  const ptSheet = sheetFromRefEntries(
    "price-types",
    ["Название", "Код", "Сортировка"],
    ["name", "code", "sort_order"],
    priceTypes as unknown as Record<string, unknown>[]
  );
  if (ptSheet) byId.set("price-types", ptSheet);

  const branches = (refs.branches as BranchDto[] | undefined) ?? [];
  const brSheet = sheetFromRefEntries(
    "branches",
    ["Название", "Код", "Сортировка"],
    ["name", "code", "sort_order"],
    branches as unknown as Record<string, unknown>[]
  );
  if (brSheet) byId.set("branches", brSheet);

  const refSheetDefs: Array<[string, string, string[]]> = [
    ["client-formats", "client_format_entries", ["name", "code", "sort_order", "comment"]],
    ["client-types", "client_type_entries", ["name", "code", "sort_order", "comment"]],
    ["client-categories", "client_category_entries", ["name", "code", "sort_order", "comment"]]
  ];
  for (const [stepId, refKey, keys] of refSheetDefs) {
    const items =
      refKey === "client_format_entries"
        ? refs.client_format_entries
        : refKey === "client_type_entries"
          ? refs.client_type_entries
          : refs.client_category_entries;
    const sh = sheetFromRefEntries(
      stepId,
      ["Название", "Код", "Сортировка", "Комментарий"],
      keys,
      items as unknown as Record<string, unknown>[]
    );
    if (sh) byId.set(stepId, sh);
  }

  const tdRows = await listTradeDirections(tenantId, { is_active: true });
  const tdSheet = sheetFromRefEntries(
    "trade-directions",
    ["Название", "Код", "Сортировка", "Комментарий"],
    ["name", "code", "sort_order", "comment"],
    tdRows as unknown as Record<string, unknown>[]
  );
  if (tdSheet) byId.set("trade-directions", tdSheet);

  const scRows = await listSalesChannelRefs(tenantId, { is_active: true });
  const scSheet = sheetFromRefEntries(
    "sales-channels",
    ["Название", "Код", "Сортировка", "Комментарий"],
    ["name", "code", "sort_order", "comment"],
    scRows as unknown as Record<string, unknown>[]
  );
  if (scSheet) byId.set("sales-channels", scSheet);

  const productsBuf = await exportTenantCatalogProductsXlsx(tenantId);
  const productRows = bufferToRows(productsBuf);
  if (productRows.length > 1) {
    byId.set("products-catalog", { sheetName: "products-catalog", rows: productRows });
  }

  const priceTypeCodes = priceTypes.map((p) => cellStr(p.code)).filter(Boolean);
  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId },
    select: { id: true }
  });
  const categoryIds = categories.map((c) => c.id);
  const currency = await getTenantDefaultCurrencyCode(tenantId);
  const priceDataRows: string[][] = [];
  const chunkSize = 50;
  for (const priceType of priceTypeCodes) {
    for (let i = 0; i < categoryIds.length; i += chunkSize) {
      const chunk = categoryIds.slice(i, i + chunkSize);
      try {
        const matrix = await listPricesMatrixForCategories(tenantId, chunk, priceType, currency);
        for (const row of matrix) {
          if (!row.sku || row.price == null) continue;
          priceDataRows.push([row.sku, priceType, String(row.price)]);
        }
      } catch {
        /* skip chunk */
      }
    }
  }
  if (priceDataRows.length) {
    byId.set("product-prices", {
      sheetName: "product-prices",
      rows: [[...PRICE_HEADERS], ...priceDataRows]
    });
  }

  const allClients: Array<Record<string, unknown>> = [];
  const limit = 500;
  let page = 1;
  let total = Infinity;
  while (allClients.length < total && page <= 50) {
    const batch = await listClientsForTenantPaged(tenantId, { page, limit });
    total = batch.total;
    for (const c of batch.data) {
      allClients.push(c as unknown as Record<string, unknown>);
    }
    if (batch.data.length < limit) break;
    page += 1;
  }
  if (allClients.length) {
    const clientRows = allClients.map((c) => [
      cellStr(c.name),
      cellStr(c.legal_name),
      cellStr(c.address),
      cellStr(c.phone),
      cellStr(c.responsible_person),
      cellStr(c.landmark),
      cellStr(c.inn),
      cellStr(c.client_pinfl),
      cellStr(c.sales_channel),
      cellStr(c.category),
      cellStr(c.client_type_code),
      cellStr(c.client_format),
      cellStr(c.city),
      cellStr(c.latitude),
      cellStr(c.longitude)
    ]);
    byId.set("clients", {
      sheetName: "clients",
      rows: [[...CLIENT_HEADERS], ...clientRows]
    });
  }

  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ sort_order: "asc" }, { slot_code: "asc" }],
    include: {
      user_links: {
        where: { ended_at: null },
        take: 1,
        include: { user: { select: { login: true } } }
      }
    }
  });
  if (slots.length) {
    const slotRows = slots.map((r) => [
      r.slot_code,
      r.label ?? "",
      r.branch_code ?? "",
      r.slot_type,
      r.is_active ? "yes" : "no",
      String(r.sort_order ?? ""),
      r.user_links[0]?.user.login ?? ""
    ]);
    byId.set("work-slots", {
      sheetName: "work-slots",
      rows: [[...WORK_SLOT_HEADERS], ...slotRows]
    });
  }

  const sheets: ExportSheet[] = [];
  for (const stepId of EXPORT_ORDER) {
    const sheet = byId.get(stepId);
    if (sheet && sheet.rows.length > 1) sheets.push(sheet);
  }
  return sheets;
}

export async function buildInitialSetupExportBuffer(tenantId: number): Promise<Buffer> {
  const sheets = await collectExportSheets(tenantId);
  if (!sheets.length) {
    throw new Error("EMPTY_EXPORT");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";
  wb.created = new Date();
  await addStartSheet(wb);
  for (const sheet of sheets) {
    addDataSheet(wb, sheet);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
