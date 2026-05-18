import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


import type { RetailStockListQuery } from "./retail-stock.types";

export function parseDateOnly(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseImportDateCell(cell: ExcelJS.Cell): Date | null {
  const v = cell.value;
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const utc = new Date((v - 25569) * 86400 * 1000);
    if (!Number.isNaN(utc.getTime())) {
      return new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()));
    }
  }
  const s = String(cell.text ?? v ?? "").trim();
  const iso = parseDateOnly(s);
  if (iso) return iso;
  const dmY = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (dmY) {
    const d = Number(dmY[1]);
    const mo = Number(dmY[2]);
    const y = Number(dmY[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

export function clampPage(n?: number): number {
  if (!n || !Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

export function clampLimit(n?: number): number {
  if (!n || !Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(500, Math.trunc(n)));
}

export function toDecimal(v: string | number | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(v);
}

export function buildWhere(tenantId: number, q: RetailStockListQuery): Prisma.RetailOutletStockWhereInput {
  const where: Prisma.RetailOutletStockWhereInput = { tenant_id: tenantId };
  const dateFrom = parseDateOnly(q.date_from);
  const dateTo = parseDateOnly(q.date_to);
  if (dateFrom || dateTo) {
    where.stock_date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {})
    };
  }
  if (q.agent_id && q.agent_id > 0) where.agent_id = q.agent_id;
  if (q.product_id && q.product_id > 0) where.product_id = q.product_id;
  if (q.price_type?.trim()) where.price_type = q.price_type.trim();
  if (q.territory_1?.trim()) where.territory_1 = q.territory_1.trim();
  if (q.territory_2?.trim()) where.territory_2 = q.territory_2.trim();
  if (q.territory_3?.trim()) where.territory_3 = q.territory_3.trim();
  if (q.category_id && q.category_id > 0) {
    where.product = { category_id: q.category_id };
  }
  return where;
}
