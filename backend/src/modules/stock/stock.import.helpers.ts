import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.movements";


export async function buildStockImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kirim", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  const headers = [
    "Ombor (ID yoki nomi)",
    "Tovar smart kodi (SKU)",
    "Shtrix kod (barcode, ixtiyoriy)",
    "Tovar nomi (ixtiyoriy, tekshiruv)",
    "Miqdor",
    "Qo'shilish sanasi (ixtiyoriy)"
  ];
  const sample = [
    "1 yoki Asosiy ombor",
    "SKU-001",
    "",
    "Namuna mahsulot",
    "10",
    "2026-03-30"
  ];

  const hRow = sheet.getRow(1);
  headers.forEach((text, i) => {
    hRow.getCell(i + 1).value = text;
    hRow.getCell(i + 1).font = { bold: true };
  });
  sample.forEach((text, i) => {
    sheet.getRow(2).getCell(i + 1).value = text;
  });
  sheet.columns = [
    { width: 28 },
    { width: 22 },
    { width: 24 },
    { width: 28 },
    { width: 12 },
    { width: 26 }
  ];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Shablon: «Поступление» — №, Склад, Код товара, Категория, Продукт, Цена, Количество прихода, Количество в блоке */
export async function buildPostupleniya2StockTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Поступление", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  const headers = [
    "№",
    "Склад",
    "Код товара",
    "Категория",
    "Продукт",
    "Цена",
    "Количество прихода",
    "Количество в блоке"
  ];
  const sample = ["1", "Основной склад", "SKU-001", "Ichimliklar", "Namuna mahsulot", "12000", "10", "1"];

  const hRow = sheet.getRow(1);
  headers.forEach((text, i) => {
    hRow.getCell(i + 1).value = text;
    hRow.getCell(i + 1).font = { bold: true };
  });
  sample.forEach((text, i) => {
    sheet.getRow(2).getCell(i + 1).value = text;
  });
  sheet.columns = [
    { width: 6 },
    { width: 22 },
    { width: 18 },
    { width: 22 },
    { width: 36 },
    { width: 12 },
    { width: 22 },
    { width: 22 }
  ];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function stockImportHeaderToKey(header: string): string | null {
  const raw = header.trim();
  const t = raw.toLowerCase().replace(/\u00a0/g, " ");
  const n = t.replace(/\s+/g, "_");

  /** «Поступление» / postupleniya-2 (rus) + № ustuni e’tiborsiz */
  if (/^№\.?$/u.test(raw.replace(/\u00a0/g, "").trim())) return null;

  if (t.includes("склад")) return "warehouse";
  if (t.includes("код") && t.includes("товар")) return "sku";
  if (t.includes("категория")) return "category";
  if (t === "продукт" || (t.includes("продукт") && !t.includes("категория"))) return "name";
  if (t === "цена" || (t.startsWith("цена") && !t.includes("приход"))) return "price";
  if (t.includes("количество") && t.includes("приход")) return "receipt_qty";
  if (t.includes("количество") && (t.includes("блок") || t.includes("block"))) return "block_qty";

  if (n.includes("ombor") || n.includes("sklad") || n === "warehouse") return "warehouse";
  if ((n.includes("smart") && n.includes("kod")) || n.includes("tovar_smart")) return "sku";
  if (n === "sku" || n.includes("artikul")) return "sku";
  if (n.includes("shtrix") || n.includes("barcode") || n.includes("штрих")) return "barcode";
  if (n.includes("tovar") && n.includes("nom")) return "name";
  if (n === "nomi" || n === "name" || (n.includes("mahsulot") && n.includes("nom"))) return "name";
  if (n.includes("miqdor") || n === "qty" || n === "soni" || n === "kol") return "qty";
  if (n.includes("sana") || n.includes("qoshilish") || n.includes("qo_shilish") || n.includes("sanasi")) {
    return "date";
  }
  if (n === "kod" && !n.includes("shtrix") && !n.includes("smart")) return "sku";
  return null;
}

export function parseQtyCell(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Excel sana raqami yoki matn */
export function parseDateCellForWarn(cell: ExcelJS.Cell): { iso: string | null; raw: string } {
  const v = cell.value;
  if (v == null || v === "") return { iso: null, raw: "" };
  if (v instanceof Date) {
    return { iso: v.toISOString().slice(0, 10), raw: v.toISOString().slice(0, 10) };
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const utc = new Date((v - 25569) * 86400 * 1000);
    if (!Number.isNaN(utc.getTime())) {
      return { iso: utc.toISOString().slice(0, 10), raw: String(v) };
    }
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return { iso: s.slice(0, 10), raw: s };
  }
  const d = Date.parse(s);
  if (!Number.isNaN(d)) {
    return { iso: new Date(d).toISOString().slice(0, 10), raw: s };
  }
  return { iso: null, raw: s };
}

export async function resolveWarehouseId(tenantId: number, raw: string): Promise<number | null> {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const id = Number.parseInt(s, 10);
    const wh = await prisma.warehouse.findFirst({ where: { id, tenant_id: tenantId } });
    return wh ? id : null;
  }
  const wh = await prisma.warehouse.findFirst({
    where: {
      tenant_id: tenantId,
      name: { equals: s, mode: "insensitive" }
    }
  });
  if (wh) return wh.id;
  const list = await prisma.warehouse.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true }
  });
  const lower = s.toLowerCase();
  const hit = list.find((w) => w.name.trim().toLowerCase() === lower);
  return hit?.id ?? null;
}

export async function resolveProductForImport(
  tenantId: number,
  skuRaw: string,
  barcodeRaw: string
): Promise<{
  id: number;
  sku: string;
  name: string;
  barcode: string | null;
  categoryName: string | null;
} | null> {
  const sku = skuRaw.trim();
  const bc = barcodeRaw.trim();
  if (sku) {
    let p = await prisma.product.findUnique({
      where: { tenant_id_sku: { tenant_id: tenantId, sku } },
      include: { category: { select: { name: true } } }
    });
    if (!p) {
      p = await prisma.product.findFirst({
        where: { tenant_id: tenantId, sku: { equals: sku, mode: "insensitive" } },
        include: { category: { select: { name: true } } }
      });
    }
    if (p) {
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        categoryName: p.category?.name ?? null
      };
    }
  }
  if (bc) {
    const found = await prisma.product.findFirst({
      where: { tenant_id: tenantId, barcode: bc },
      include: { category: { select: { name: true } } }
    });
    if (found) {
      return {
        id: found.id,
        sku: found.sku,
        name: found.name,
        barcode: found.barcode,
        categoryName: found.category?.name ?? null
      };
    }
  }
  return null;
}

export type StockImportResult = {
  applied: number;
  errors: string[];
  warnings: string[];
};

export type StockImportOptions = {
  /** «Поступление» shablonida «Склад» ustuni bo‘lmasa — barcha qatorlar shu omborga */
  defaultWarehouseId?: number;
};
