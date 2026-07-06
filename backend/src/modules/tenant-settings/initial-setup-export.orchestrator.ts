import ExcelJS from "exceljs";
import { listSalesChannelRefs } from "../sales-directions/sales-directions.channels";
import { listTradeDirections } from "../sales-directions/sales-directions.trade";
import { getTenantProfile } from "./tenant-settings.service";
import type { BranchDto, UnitMeasureDto } from "./tenant-settings.types";
import type { CurrencyEntryDto, PaymentMethodEntryDto, PriceTypeEntryDto } from "./finance-refs";
import { collectClientExportSheets } from "./initial-setup-export.clients";
import { collectProductExportSheets } from "./initial-setup-export.products";
import {
  applyDataStyle,
  applyHeaderStyle,
  C,
  EXPORT_ORDER,
  sheetFromRefEntries,
  START_SHEET_TAB,
  STEP_TAB,
  tabColorForStep,
  uniqueTabName,
  type ExportSheet
} from "./initial-setup-export.shared";

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

  for (const sheet of await collectProductExportSheets(tenantId, priceTypes)) {
    byId.set(sheet.sheetName, sheet);
  }

  for (const sheet of await collectClientExportSheets(tenantId)) {
    byId.set(sheet.sheetName, sheet);
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
