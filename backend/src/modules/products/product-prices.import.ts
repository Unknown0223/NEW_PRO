import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  priceTypeEntriesFromUnknown,
  priceTypeKey
} from "../tenant-settings/finance-refs";
import { settingsRefRecord } from "../reference/reference.shared";
const DEFAULT_PRICE_TYPE = "retail";

const META_HEADERS = new Set([
  "sku",
  "kod",
  "artikul",
  "артикул",
  "артикул_sku",
  "name",
  "название",
  "наименование",
  "nomi",
  "product",
  "продукт",
  "category",
  "категория",
  "comment",
  "комментарий"
]);

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, "_")
    .replace(/ё/g, "е");
}

function isSkuHeader(n: string): boolean {
  return (
    n === "sku" ||
    n === "kod" ||
    n === "artikul" ||
    n.includes("артикул") ||
    n === "код_товара"
  );
}

function isPriceTypeHeader(n: string): boolean {
  return (
    n === "price_type" ||
    n === "tur" ||
    n === "тип_цены" ||
    n === "тип_цены_код" ||
    n.includes("narx_turi") ||
    n.includes("тип_цен")
  );
}

function isPriceHeader(n: string): boolean {
  return (
    n === "price" ||
    n === "narxi" ||
    n === "цена" ||
    n === "summa" ||
    n === "сумма" ||
    n.includes("narx") ||
    n.includes("сумма")
  );
}

function isMetaHeader(n: string): boolean {
  if (META_HEADERS.has(n)) return true;
  if (isSkuHeader(n)) return true;
  return false;
}

function parsePriceNum(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "result" in raw) {
    const r = (raw as { result?: unknown }).result;
    return parsePriceNum(r);
  }
  const n = Number.parseFloat(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function findProductBySkuOrName(tenantId: number, skuOrName: string) {
  const key = skuOrName.trim();
  if (!key) return null;
  const bySku = await prisma.product.findUnique({
    where: { tenant_id_sku: { tenant_id: tenantId, sku: key } }
  });
  if (bySku) return bySku;
  return prisma.product.findFirst({
    where: {
      tenant_id: tenantId,
      name: { equals: key, mode: "insensitive" }
    }
  });
}

async function loadPriceTypeResolver(tenantId: number): Promise<(raw: string) => string> {
  const refs = await settingsRefRecord(tenantId);
  const entries = priceTypeEntriesFromUnknown(refs.price_type_entries).filter(
    (e) => e.active !== false
  );

  return (raw: string) => {
    const s = raw.trim();
    if (!s) return DEFAULT_PRICE_TYPE;
    const lower = s.toLowerCase();
    for (const e of entries) {
      const key = priceTypeKey(e);
      if (key.toLowerCase() === lower) return key;
      if (e.name.trim().toLowerCase() === lower) return key;
      if ((e.code ?? "").trim().toLowerCase() === lower) return key;
    }
    return s;
  };
}

type LongRow = { rowNum: number; sku: string; price_type: string; price: number };

function collectLongRows(
  sheet: ExcelJS.Worksheet,
  skuCol: number,
  priceCol: number,
  typeCol: number | undefined,
  resolveType: (raw: string) => string
): LongRow[] {
  const out: LongRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = String(row.getCell(skuCol).text ?? "").trim();
    const priceRaw = row.getCell(priceCol).value;
    const priceNum = parsePriceNum(priceRaw);
    const typeCell = typeCol ? row.getCell(typeCol).text : "";
    const price_type = resolveType(String(typeCell ?? "").trim() || DEFAULT_PRICE_TYPE);
    if (!sku && (priceRaw == null || priceRaw === "")) continue;
    if (!sku) continue;
    if (priceNum == null || priceNum < 0) continue;
    out.push({ rowNum: r, sku, price_type, price: priceNum });
  }
  return out;
}

function collectWideRows(
  sheet: ExcelJS.Worksheet,
  skuCol: number,
  typeCols: Array<{ col: number; label: string }>,
  resolveType: (raw: string) => string
): LongRow[] {
  const out: LongRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = String(row.getCell(skuCol).text ?? "").trim();
    if (!sku) continue;
    for (const tc of typeCols) {
      const priceRaw = row.getCell(tc.col).value;
      if (priceRaw == null || priceRaw === "") continue;
      const priceNum = parsePriceNum(priceRaw);
      if (priceNum == null || priceNum < 0) continue;
      out.push({
        rowNum: r,
        sku,
        price_type: resolveType(tc.label),
        price: priceNum
      });
    }
  }
  return out;
}

export async function importProductPricesFromXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  actorUserId: number | null = null
): Promise<{ upserted: number; errors: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { upserted: 0, errors: ["Varaq topilmadi"] };
  }

  const resolveType = await loadPriceTypeResolver(tenantId);
  const headerRow = sheet.getRow(1);
  let skuCol: number | undefined;
  let priceCol: number | undefined;
  let typeCol: number | undefined;
  const wideTypeCols: Array<{ col: number; label: string }> = [];

  headerRow.eachCell((cell, colNumber) => {
    const label = cell.text?.trim() ?? "";
    if (!label) return;
    const n = normHeader(label);
    if (isSkuHeader(n) && skuCol == null) {
      skuCol = colNumber;
      return;
    }
    if (isPriceTypeHeader(n) && typeCol == null) {
      typeCol = colNumber;
      return;
    }
    if (isPriceHeader(n) && priceCol == null) {
      priceCol = colNumber;
      return;
    }
    if (!isMetaHeader(n) && !isPriceTypeHeader(n) && !isPriceHeader(n)) {
      wideTypeCols.push({ col: colNumber, label: label.trim() });
    }
  });

  if (!skuCol) {
    return {
      upserted: 0,
      errors: [
        "В первой строке обязателен столбец «Артикул (SKU)». Широкий формат: Артикул | Наличные | Терминал | … или длинный: Артикул | Тип цены | Цена."
      ]
    };
  }

  const isLong = priceCol != null;
  const isWide = !isLong && wideTypeCols.length > 0;
  if (!isLong && !isWide) {
    return {
      upserted: 0,
      errors: [
        "Не найдены колонки цен. Широкий формат: Артикул | Наличные | Терминал | Перечисление. Длинный: Артикул | Тип цены | Цена."
      ]
    };
  }

  const items = isLong
    ? collectLongRows(sheet, skuCol, priceCol!, typeCol, resolveType)
    : collectWideRows(sheet, skuCol, wideTypeCols, resolveType);

  let upserted = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const product = await findProductBySkuOrName(tenantId, item.sku);
      if (!product) {
        errors.push(`Qator ${item.rowNum}: SKU/nom topilmadi (${item.sku})`);
        continue;
      }
      await prisma.productPrice.upsert({
        where: {
          tenant_id_product_id_price_type: {
            tenant_id: tenantId,
            product_id: product.id,
            price_type: item.price_type
          }
        },
        create: {
          tenant_id: tenantId,
          product_id: product.id,
          price_type: item.price_type,
          price: new Prisma.Decimal(item.price)
        },
        update: { price: new Prisma.Decimal(item.price) }
      });
      upserted += 1;
    } catch (e) {
      errors.push(`Qator ${item.rowNum}: ${e instanceof Error ? e.message : "xato"}`);
    }
  }

  if (upserted > 0) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.product_price,
      entityId: "bulk",
      action: "import.xlsx",
      payload: { upserted, error_count: errors.length, format: isWide ? "wide" : "long" }
    });
    void invalidatePriceTypesCache(tenantId);
  }

  return { upserted, errors };
}
