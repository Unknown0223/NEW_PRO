import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { localDayStart, localDayEnd } from "./returns-enhanced.helpers";
import { acceptSalesReturn } from "./returns-enhanced.accept";

/**
 * «Возвратные накладные» — har bir DASTAVCHIK (yaratuvchi) bo'yicha, AYNAN
 * shu KUNGA tegishli yaxlit (aggregat) qaytarish nakladnoyi.
 *
 * Bir dastavchik ketma-ket ikki kun qaytargan bo'lsa — ikkita alohida hujjat
 * (har kun uchun bittadan). Yaratilgan vaqti o'zgarmaydi; qabul (podtverdit)
 * faqat zavsklad tasdiqlagandan keyin va tasdiqlangan kuni bilan kiradi.
 */

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function creationChannel(role: string | null | undefined): "web" | "mobile" {
  const r = (role ?? "").toLowerCase();
  if (r.includes("agent") || r.includes("expeditor")) return "mobile";
  return "web";
}

/** Guruh holatini yig'indi bo'yicha aniqlash. */
function aggregateStatus(statuses: string[]): "pending" | "posted" | "cancelled" {
  if (statuses.some((s) => s === "pending")) return "pending";
  if (statuses.some((s) => s === "posted")) return "posted";
  return "cancelled";
}

type DailyWaybillFilters = {
  warehouse_id?: number;
  courier_id?: number;
  status?: "pending" | "posted" | "cancelled";
  date_from?: string;
  date_to?: string;
  warehouse_ids?: number[];
  client_ids?: number[];
};

const returnSelect = {
  id: true,
  number: true,
  status: true,
  created_at: true,
  accepted_at: true,
  refund_amount: true,
  warehouse_id: true,
  created_by_user_id: true,
  warehouse: { select: { name: true } },
  created_by: { select: { name: true, login: true, role: true } },
  client: { select: { id: true, name: true } },
  order: { select: { number: true } },
  lines: {
    orderBy: { id: "asc" as const },
    select: {
      product_id: true,
      qty: true,
      product: {
        select: {
          sku: true,
          name: true,
          category_id: true,
          category: { select: { name: true, sort_order: true } }
        }
      }
    }
  }
} as const;

type ReturnRow = Prisma.SalesReturnGetPayload<{ select: typeof returnSelect }>;

function buildWhere(tenantId: number, f: DailyWaybillFilters): Prisma.SalesReturnWhereInput {
  const where: Prisma.SalesReturnWhereInput = { tenant_id: tenantId };
  if (f.warehouse_id) where.warehouse_id = f.warehouse_id;
  if (f.courier_id != null) {
    where.created_by_user_id = f.courier_id === 0 ? null : f.courier_id;
  }
  if (f.warehouse_ids && f.warehouse_ids.length > 0) {
    where.warehouse_id = { in: f.warehouse_ids };
  }
  if (f.client_ids && f.client_ids.length > 0) {
    where.client_id = { in: f.client_ids };
  }
  if (f.date_from || f.date_to) {
    where.created_at = {};
    if (f.date_from) where.created_at.gte = localDayStart(f.date_from);
    if (f.date_to) where.created_at.lte = localDayEnd(f.date_to);
  }
  return where;
}

export type DailyReturnWaybillRow = {
  id: string;
  courier_id: number;
  courier_name: string | null;
  creation_channel: "web" | "mobile";
  date: string;
  created_at: string;
  warehouse_name: string;
  warehouse_count: number;
  return_count: number;
  item_count: number;
  total_qty: number;
  refund_total: string;
  status: "pending" | "posted" | "cancelled";
  pending_count: number;
  accepted_at: string | null;
};

export async function listDailyReturnWaybills(
  tenantId: number,
  filters: DailyWaybillFilters
): Promise<{ data: DailyReturnWaybillRow[] }> {
  const rows = await prisma.salesReturn.findMany({
    where: buildWhere(tenantId, filters),
    orderBy: { created_at: "desc" },
    select: returnSelect
  });

  const groups = new Map<string, ReturnRow[]>();
  for (const r of rows) {
    const courierId = r.created_by_user_id ?? 0;
    const key = `${courierId}__${localDateKey(r.created_at)}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const data: DailyReturnWaybillRow[] = [];
  for (const [key, list] of groups) {
    const status = aggregateStatus(list.map((r) => r.status));
    if (filters.status && status !== filters.status) continue;

    const courierId = list[0].created_by_user_id ?? 0;
    const dateKey = localDateKey(list[0].created_at);
    const courier = list[0].created_by;

    const products = new Set<number>();
    let totalQty = 0;
    let refundTotal = new Prisma.Decimal(0);
    const warehouses = new Set<number>();
    let earliest = list[0].created_at;
    let latestAccepted: Date | null = null;
    let pendingCount = 0;

    for (const r of list) {
      warehouses.add(r.warehouse_id);
      if (r.created_at < earliest) earliest = r.created_at;
      if (r.status === "pending") pendingCount += 1;
      if (r.accepted_at && (latestAccepted == null || r.accepted_at > latestAccepted)) {
        latestAccepted = r.accepted_at;
      }
      if (r.refund_amount) refundTotal = refundTotal.add(r.refund_amount);
      for (const ln of r.lines) {
        products.add(ln.product_id);
        totalQty += Number(ln.qty);
      }
    }

    const firstWarehouseName = list.find((r) => r.warehouse?.name)?.warehouse?.name ?? "";

    data.push({
      id: key,
      courier_id: courierId,
      courier_name: courier?.name?.trim() || courier?.login?.trim() || null,
      creation_channel: creationChannel(courier?.role),
      date: dateKey,
      created_at: earliest.toISOString(),
      warehouse_name: warehouses.size > 1 ? "Несколько складов" : firstWarehouseName,
      warehouse_count: warehouses.size,
      return_count: list.length,
      item_count: products.size,
      total_qty: totalQty,
      refund_total: refundTotal.toString(),
      status,
      pending_count: pendingCount,
      accepted_at: latestAccepted ? latestAccepted.toISOString() : null
    });
  }

  data.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return { data };
}

export type DailyReturnWaybillDetail = {
  courier_id: number;
  courier_name: string | null;
  creation_channel: "web" | "mobile";
  date: string;
  created_at: string;
  warehouse_name: string;
  status: "pending" | "posted" | "cancelled";
  pending_count: number;
  accepted_at: string | null;
  total_qty: number;
  refund_total: string;
  /** Mahsulot bo'yicha yaxlit qatorlar (kod, nom, jami miqdor) — kategoriya bo'yicha tartiblangan. */
  lines: {
    product_id: number;
    sku: string;
    name: string;
    qty: string;
    category_id: number | null;
    category_name: string | null;
  }[];
  /** Tarkibidagi alohida qaytarish hujjatlari (mijoz/zakaz bo'yicha). */
  returns: {
    id: number;
    number: string;
    status: string;
    client_name: string | null;
    order_number: string | null;
    qty: string;
    refund_amount: string | null;
  }[];
};

export async function getDailyReturnWaybillDetail(
  tenantId: number,
  courierId: number,
  date: string
): Promise<DailyReturnWaybillDetail | null> {
  const list = await prisma.salesReturn.findMany({
    where: {
      tenant_id: tenantId,
      created_by_user_id: courierId === 0 ? null : courierId,
      created_at: { gte: localDayStart(date), lte: localDayEnd(date) }
    },
    orderBy: { created_at: "asc" },
    select: returnSelect
  });
  if (list.length === 0) return null;

  const courier = list[0].created_by;
  const warehouses = new Set<number>();
  let earliest = list[0].created_at;
  let latestAccepted: Date | null = null;
  let pendingCount = 0;
  let totalQty = 0;
  let refundTotal = new Prisma.Decimal(0);

  const lineMap = new Map<
    number,
    {
      product_id: number;
      sku: string;
      name: string;
      qty: Prisma.Decimal;
      category_id: number | null;
      category_name: string | null;
      category_sort: number;
    }
  >();
  const returns: DailyReturnWaybillDetail["returns"] = [];

  for (const r of list) {
    warehouses.add(r.warehouse_id);
    if (r.created_at < earliest) earliest = r.created_at;
    if (r.status === "pending") pendingCount += 1;
    if (r.accepted_at && (latestAccepted == null || r.accepted_at > latestAccepted)) {
      latestAccepted = r.accepted_at;
    }
    if (r.refund_amount) refundTotal = refundTotal.add(r.refund_amount);

    let returnQty = new Prisma.Decimal(0);
    for (const ln of r.lines) {
      const q = new Prisma.Decimal(ln.qty);
      returnQty = returnQty.add(q);
      totalQty += Number(ln.qty);
      const ex = lineMap.get(ln.product_id);
      if (ex) {
        ex.qty = ex.qty.add(q);
      } else {
        lineMap.set(ln.product_id, {
          product_id: ln.product_id,
          sku: ln.product.sku,
          name: ln.product.name,
          qty: q,
          category_id: ln.product.category_id ?? null,
          category_name: ln.product.category?.name ?? null,
          category_sort: ln.product.category?.sort_order ?? 1_000_000
        });
      }
    }

    returns.push({
      id: r.id,
      number: r.number,
      status: r.status,
      client_name: r.client?.name ?? null,
      order_number: r.order?.number ?? null,
      qty: returnQty.toString(),
      refund_amount: r.refund_amount ? r.refund_amount.toString() : null
    });
  }

  const lines = Array.from(lineMap.values())
    .sort((a, b) => {
      // Kategoriya bo'yicha tartiblash (sort_order → nom), so'ng mahsulot nomi.
      if (a.category_sort !== b.category_sort) return a.category_sort - b.category_sort;
      const ca = a.category_name ?? "\uffff";
      const cb = b.category_name ?? "\uffff";
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name);
    })
    .map((l) => ({
      product_id: l.product_id,
      sku: l.sku,
      name: l.name,
      qty: l.qty.toString(),
      category_id: l.category_id,
      category_name: l.category_name
    }));

  const firstWarehouseName = list.find((r) => r.warehouse?.name)?.warehouse?.name ?? "";

  return {
    courier_id: courierId,
    courier_name: courier?.name?.trim() || courier?.login?.trim() || null,
    creation_channel: creationChannel(courier?.role),
    date,
    created_at: earliest.toISOString(),
    warehouse_name: warehouses.size > 1 ? "Несколько складов" : firstWarehouseName,
    status: aggregateStatus(list.map((r) => r.status)),
    pending_count: pendingCount,
    accepted_at: latestAccepted ? latestAccepted.toISOString() : null,
    total_qty: totalQty,
    refund_total: refundTotal.toString(),
    lines,
    returns
  };
}

/**
 * Kunlik yaxlit nakladnoyni QABUL QILISH — guruhdagi barcha `pending`
 * qaytarishlarni zavsklad tasdiqlaydi (har biriga side-effect qo'llanadi).
 * Qabul vaqti (accepted_at) shu tasdiqlash kuni bo'ladi; yaratilgan vaqt
 * o'zgarmaydi. Jarayon ORQAGA QAYTMAYDI.
 */
export async function acceptDailyReturnWaybill(
  tenantId: number,
  courierId: number,
  date: string,
  actorUserId: number | null
): Promise<{ accepted_count: number; already_count: number; total: number }> {
  const list = await prisma.salesReturn.findMany({
    where: {
      tenant_id: tenantId,
      created_by_user_id: courierId === 0 ? null : courierId,
      created_at: { gte: localDayStart(date), lte: localDayEnd(date) }
    },
    select: { id: true, status: true }
  });
  if (list.length === 0) throw new Error("WAYBILL_NOT_FOUND");

  const pending = list.filter((r) => r.status === "pending");
  if (pending.length === 0) throw new Error("WAYBILL_NOTHING_PENDING");

  let accepted = 0;
  for (const r of pending) {
    await acceptSalesReturn(tenantId, r.id, actorUserId);
    accepted += 1;
  }

  return {
    accepted_count: accepted,
    already_count: list.length - pending.length,
    total: list.length
  };
}
