import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

/** Ustun nomlarini ichki kalitga map qilish */
export function headerToKey(h: string): string | null {
  const n = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (n === "sku" || n === "kod" || n.includes("артикул") || n === "artikul") return "sku";
  if (n === "name" || n === "nom" || n === "nomi" || n === "title" || n.includes("mahsulot")) return "name";
  if (n === "unit" || n === "birlik") return "unit";
  if (n.includes("barcode") || n.includes("shtrix") || n.includes("штрих")) return "barcode";
  return null;
}

/** Shablon ustunlari (rasmdagi import) — yulduzcha sarlavhada, majburiy ustunlar tekshiriladi */
export const CATALOG_IMPORT_TEMPLATE_HEADERS = [
  "Название *",
  "Код",
  "Категория(код) *",
  "Единица измерения(код) *",
  "Группа(код)",
  "Сегмент(код)",
  "Штрих код",
  "ТНВЭД код",
  "Бренд(код)",
  "Сортировка",
  "Вес(кг)",
  "Количество в блоке",
  "Длина(м)",
  "Ширина(м)",
  "Толщина(м)"
] as const;

export type TemplateCol =
  | "name"
  | "code"
  | "categoryCode"
  | "unitCode"
  | "groupCode"
  | "segmentCode"
  | "barcode"
  | "hsCode"
  | "brandCode"
  | "sortOrder"
  | "weightKg"
  | "qtyBlock"
  | "lengthM"
  | "widthM"
  | "thicknessM";

export function normalizeTemplateHeader(raw: string): string {
  return raw
    .replace(/\*/g, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function headerToTemplateCol(raw: string): TemplateCol | null {
  const h = normalizeTemplateHeader(raw);
  if (!h) return null;
  if (h.includes("название")) return "name";
  if (h.includes("категория")) return "categoryCode";
  if (h.includes("единица") && h.includes("измер")) return "unitCode";
  if (h.includes("группа") && h.includes("код")) return "groupCode";
  if (h.includes("сегмент")) return "segmentCode";
  if (h.includes("штрих") || h.replace(/\s/g, "").includes("штрихкод")) return "barcode";
  if (h.includes("тнвэд") || h.includes("тн вэд")) return "hsCode";
  if (h.includes("бренд")) return "brandCode";
  if (h.includes("сортировка")) return "sortOrder";
  if (h.includes("вес")) return "weightKg";
  if (h.includes("количество") && h.includes("блок")) return "qtyBlock";
  if (h.includes("длина")) return "lengthM";
  if (h.includes("ширина")) return "widthM";
  if (h.includes("толщина")) return "thicknessM";
  if (h === "код") return "code";
  return null;
}

export function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return "";
  const c = row.getCell(col);
  const t = c.text?.trim();
  if (t) return t;
  const v = c.value;
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "object" && v !== null && "text" in (v as object)) {
    return String((v as { text: string }).text ?? "").trim();
  }
  return String(v).trim();
}

export function parseNumLoose(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(",", ".").trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export async function resolveCategoryIdByCode(tenantId: number, code: string): Promise<number | null> {
  const t = code.trim();
  if (!t) return null;
  const row = await prisma.productCategory.findFirst({
    where: {
      tenant_id: tenantId,
      code: { equals: t, mode: "insensitive" }
    }
  });
  return row?.id ?? null;
}

export async function resolveCatalogGroupIdByCode(tenantId: number, code: string): Promise<number | null> {
  const t = code.trim();
  if (!t) return null;
  const row = await prisma.productCatalogGroup.findFirst({
    where: { tenant_id: tenantId, code: { equals: t, mode: "insensitive" } }
  });
  return row?.id ?? null;
}

export async function resolveSegmentIdByCode(tenantId: number, code: string): Promise<number | null> {
  const t = code.trim();
  if (!t) return null;
  const row = await prisma.productSegment.findFirst({
    where: { tenant_id: tenantId, code: { equals: t, mode: "insensitive" } }
  });
  return row?.id ?? null;
}

export async function resolveBrandIdByCode(tenantId: number, code: string): Promise<number | null> {
  const t = code.trim();
  if (!t) return null;
  const row = await prisma.productBrand.findFirst({
    where: { tenant_id: tenantId, code: { equals: t, mode: "insensitive" } }
  });
  return row?.id ?? null;
}

export async function allocateUniqueSku(tenantId: number, base: string): Promise<string> {
  let s = base.slice(0, 80);
  let n = 0;
  while (
    await prisma.product.findUnique({
      where: { tenant_id_sku: { tenant_id: tenantId, sku: s } }
    })
  ) {
    n += 1;
    s = `${base.slice(0, 60)}_${n}`.slice(0, 80);
  }
  return s;
}
