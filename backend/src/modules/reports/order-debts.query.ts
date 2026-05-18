import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildClientWhere,
  buildOrderCreatedLocalDateClause,
  loadTenantPaymentRefs,
  sqlIntIdToNumber,
  type ClientBalanceListQuery
} from "../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import type { OrderDebtsListQuery } from "./order-debts.types";

const PAYMENT_NOT_PENDING = Prisma.sql`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;

import { parseOrderDebtsListQuery } from "./order-debts.parse";

export function orderConsignmentModeSql(mode: OrderDebtsListQuery["order_consignment"]): Prisma.Sql {
  if (mode === "consignment") {
    return Prisma.sql`AND (
      o.is_consignment = true
      OR EXISTS (
        SELECT 1 FROM users ag
        WHERE ag.id = o.agent_id AND ag.tenant_id = o.tenant_id AND ag.consignment = true
      )
    )`;
  }
  if (mode === "regular") {
    return Prisma.sql`AND NOT (
      o.is_consignment = true
      OR EXISTS (
        SELECT 1 FROM users ag
        WHERE ag.id = o.agent_id AND ag.tenant_id = o.tenant_id AND ag.consignment = true
      )
    )`;
  }
  return Prisma.empty;
}

export function shipmentDateClause(from?: string, to?: string): Prisma.Sql {
  const f = from?.trim();
  const t = to?.trim();
  if (!f && !t) return Prisma.empty;
  const fUtc = f ? new Date(`${f}T00:00:00.000Z`) : null;
  const tUtc = t ? new Date(`${t}T23:59:59.999Z`) : null;
  if (fUtc && Number.isNaN(fUtc.getTime())) return Prisma.empty;
  if (tUtc && Number.isNaN(tUtc.getTime())) return Prisma.empty;
  if (fUtc && tUtc) {
    return Prisma.sql`AND ship.shipped_at IS NOT NULL AND ship.shipped_at >= ${fUtc} AND ship.shipped_at <= ${tUtc}`;
  }
  if (fUtc) {
    return Prisma.sql`AND ship.shipped_at IS NOT NULL AND ship.shipped_at >= ${fUtc}`;
  }
  if (tUtc) {
    return Prisma.sql`AND ship.shipped_at IS NOT NULL AND ship.shipped_at <= ${tUtc}`;
  }
  return Prisma.empty;
}

export function orderConsignmentDueClause(from?: string, to?: string): Prisma.Sql {
  const f = from?.trim();
  const t = to?.trim();
  if (!f && !t) return Prisma.empty;
  const fUtc = f ? new Date(`${f}T00:00:00.000Z`) : null;
  const tUtc = t ? new Date(`${t}T23:59:59.999Z`) : null;
  if (fUtc && Number.isNaN(fUtc.getTime())) return Prisma.empty;
  if (tUtc && Number.isNaN(tUtc.getTime())) return Prisma.empty;
  if (fUtc && tUtc) {
    return Prisma.sql`AND o.consignment_due_date IS NOT NULL AND o.consignment_due_date >= ${fUtc} AND o.consignment_due_date <= ${tUtc}`;
  }
  if (fUtc) {
    return Prisma.sql`AND o.consignment_due_date IS NOT NULL AND o.consignment_due_date >= ${fUtc}`;
  }
  if (tUtc) {
    return Prisma.sql`AND o.consignment_due_date IS NOT NULL AND o.consignment_due_date <= ${tUtc}`;
  }
  return Prisma.empty;
}

export function tableSearchClause(search: string | undefined): Prisma.Sql {
  const s = search?.trim();
  if (!s) return Prisma.empty;
  const pat = `%${s.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return Prisma.sql`AND (
    c.name ILIKE ${pat}
    OR COALESCE(c.phone, '') ILIKE ${pat}
    OR o.number ILIKE ${pat}
  )`;
}

export function warehouseClause(ids: number[]): Prisma.Sql {
  if (ids.length === 0) return Prisma.empty;
  return Prisma.sql`AND o.warehouse_id IN (${Prisma.join(ids)})`;
}

export function expeditorOrderClause(expeditorUserId: number | undefined): Prisma.Sql {
  if (expeditorUserId == null || expeditorUserId <= 0) return Prisma.empty;
  return Prisma.sql`AND o.expeditor_user_id = ${expeditorUserId}`;
}

export function orderPaymentRefClause(ref: string | undefined): Prisma.Sql {
  const r = ref?.trim();
  if (!r) return Prisma.empty;
  const pat = `%${r.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return Prisma.sql`AND COALESCE(o.payment_method_ref, '') ILIKE ${pat}`;
}

/** `buildClientWhere` dan tashqari maxsus filtrlar — ro‘yxat prefetch kerak. */
export function orderDebtsNeedsClientIdList(q: OrderDebtsListQuery): boolean {
  if (q.explicit_client_ids && q.explicit_client_ids.length > 0) return true;
  if (q.agent_id != null && q.agent_id > 0) return true;
  if (q.expeditor_user_id != null && q.expeditor_user_id > 0) return true;
  if (q.supervisor_user_id != null && q.supervisor_user_id > 0) return true;
  if (q.trade_direction?.trim()) return true;
  if (q.category?.trim()) return true;
  const st = q.status?.trim();
  if (st === "active" || st === "inactive") return true;
  const ac = q.agent_consignment?.trim();
  if (ac === "consignment" || ac === "regular") return true;
  if (q.agent_branch?.trim()) return true;
  if ((q.agent_branches?.length ?? 0) > 0) return true;
  if (q.consignment_due_from?.trim() || q.consignment_due_to?.trim()) return true;
  if (
    q.territory_region?.trim() ||
    q.territory_city?.trim() ||
    q.territory_district?.trim() ||
    q.territory_zone?.trim()
  ) {
    return true;
  }
  if (q.agent_payment_type?.trim()) return true;
  return false;
}

/** `null` — barcha merged emas mijozlar (subquery); `[]` — bo‘sh natija. */
export function clientIdsScopeClause(tenantId: number, clientIds: number[] | null): Prisma.Sql {
  if (clientIds === null) {
    return Prisma.sql`AND o.client_id IN (
      SELECT c2.id FROM clients c2
      WHERE c2.tenant_id = ${tenantId} AND c2.merged_into_client_id IS NULL
    )`;
  }
  if (clientIds.length === 0) {
    return Prisma.sql`AND false`;
  }
  return Prisma.sql`AND o.client_id = ANY(${clientIds}::int[])`;
}

export type OrderDebtRow = {
  order_id: number;
  order_number: string;
  /** `orders.status` — hisobotda asosan `delivered` */
  order_status: string;
  client_id: number;
  client_name: string;
  /** Hozircha tenant valyutasi bilan mos: SQL da `UZS` */
  currency: string;
  address: string | null;
  landmark: string | null;
  phone: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  expeditor_user_id: number | null;
  expeditor_name: string | null;
  expeditor_code: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  total_sum: string;
  /** Zakazga taqsimlangan to‘lovlar (payment_allocations), `total_sum` dan oshmasin */
  allocated_sum: string;
  payment_method_label: string | null;
  /** Birinchi `delivering|delivered` log sanasi */
  shipped_at: string | null;
  consignment_due_date: string | null;
  remainder: string;
  /** Mijoz bo‘yicha kassadan taqsimlanmagan pul (barcha zakazlar uchun bir xil client_id qatorida) */
  unallocated: string;
  /** `client_balances.balance` */
  client_balance: string;
};

export type OrderDebtsListResponse = {
  data: OrderDebtRow[];
  total: number;
  page: number;
  limit: number;
  summary: { total_remainder: string; currency: string };
};

type RawOrderDebtRow = {
  order_id: unknown;
  order_number: string;
  order_status: string;
  client_id: unknown;
  client_name: string;
  currency: string;
  address: string | null;
  landmark: string | null;
  phone: string | null;
  agent_id: unknown;
  agent_name: string | null;
  agent_code: string | null;
  expeditor_user_id: unknown;
  expeditor_name: string | null;
  expeditor_code: string | null;
  warehouse_id: unknown;
  warehouse_name: string | null;
  total_sum: Prisma.Decimal;
  allocated_sum: Prisma.Decimal;
  payment_method_ref: string | null;
  shipped_at: Date | null;
  consignment_due_date: Date | null;
  remainder: Prisma.Decimal;
  client_balance: Prisma.Decimal;
};

export function readSort(q: OrderDebtsListQuery): { col: string; dir: 1 | -1 } {
  const col = q.sort_by?.trim() || "remainder";
  const dir: 1 | -1 = q.sort_dir === "asc" ? 1 : -1;
  const allowed = new Set([
    "remainder",
    "shipped_at",
    "total_sum",
    "order_number",
    "client_name",
    "currency",
    "address",
    "landmark",
    "phone",
    "agent_name",
    "expeditor_name",
    "warehouse_name",
    "payment_method_ref",
    "consignment_due_date",
    "allocated_sum",
    "client_balance"
  ]);
  return { col: allowed.has(col) ? col : "remainder", dir };
}

/** `SELECT * FROM base WHERE …` dan keyin — `base` ustun nomlari. */
export function orderBySql(sort: { col: string; dir: 1 | -1 }): Prisma.Sql {
  const d = sort.dir === 1 ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  switch (sort.col) {
    case "shipped_at":
      return Prisma.sql`ORDER BY shipped_at ${d} NULLS LAST, order_id DESC`;
    case "consignment_due_date":
      return Prisma.sql`ORDER BY consignment_due_date ${d} NULLS LAST, order_id DESC`;
    case "total_sum":
      return Prisma.sql`ORDER BY total_sum ${d}, order_id DESC`;
    case "allocated_sum":
      return Prisma.sql`ORDER BY allocated_sum ${d}, order_id DESC`;
    case "remainder":
      return Prisma.sql`ORDER BY remainder ${d}, order_id DESC`;
    case "client_balance":
      return Prisma.sql`ORDER BY client_balance ${d}, order_id DESC`;
    case "order_number":
      return Prisma.sql`ORDER BY order_number ${d}, order_id DESC`;
    case "client_name":
      return Prisma.sql`ORDER BY client_name ${d} NULLS LAST, order_id DESC`;
    case "currency":
      return Prisma.sql`ORDER BY currency ${d}, order_id DESC`;
    case "address":
      return Prisma.sql`ORDER BY address ${d} NULLS LAST, order_id DESC`;
    case "landmark":
      return Prisma.sql`ORDER BY landmark ${d} NULLS LAST, order_id DESC`;
    case "phone":
      return Prisma.sql`ORDER BY phone ${d} NULLS LAST, order_id DESC`;
    case "agent_name":
      return Prisma.sql`ORDER BY agent_name ${d} NULLS LAST, order_id DESC`;
    case "expeditor_name":
      return Prisma.sql`ORDER BY expeditor_name ${d} NULLS LAST, order_id DESC`;
    case "warehouse_name":
      return Prisma.sql`ORDER BY warehouse_name ${d} NULLS LAST, order_id DESC`;
    case "payment_method_ref":
      return Prisma.sql`ORDER BY COALESCE(payment_method_ref, '') ${d}, order_id DESC`;
    default:
      return Prisma.sql`ORDER BY remainder ${d}, order_id DESC`;
  }
}

export async function loadUnallocatedByClient(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, Prisma.Decimal>> {
  const out = new Map<number, Prisma.Decimal>();
  if (clientIds.length === 0) return out;
  const chunk = 5000;
  for (let i = 0; i < clientIds.length; i += chunk) {
    const part = clientIds.slice(i, i + chunk);
    const rows = await prisma.$queryRaw<Array<{ client_id: unknown; unallocated: Prisma.Decimal }>>`
      WITH pay AS (
        SELECT p.client_id,
          SUM(CASE WHEN p.entry_kind = 'payment' THEN p.amount ELSE 0 END)::decimal(15,2) AS pay_sum
        FROM client_payments p
        WHERE p.tenant_id = ${tenantId}
          AND p.client_id IN (${Prisma.join(part)})
          AND p.deleted_at IS NULL
          AND ${PAYMENT_NOT_PENDING}
        GROUP BY p.client_id
      ),
      alc AS (
        SELECT p.client_id,
          SUM(pa.amount)::decimal(15,2) AS alloc_sum
        FROM payment_allocations pa
        INNER JOIN client_payments p ON p.id = pa.payment_id AND p.tenant_id = pa.tenant_id
        WHERE pa.tenant_id = ${tenantId}
          AND p.client_id IN (${Prisma.join(part)})
          AND p.deleted_at IS NULL
          AND ${PAYMENT_NOT_PENDING}
        GROUP BY p.client_id
      )
      SELECT pay.client_id,
        (COALESCE(pay.pay_sum, 0) - COALESCE(alc.alloc_sum, 0))::decimal(15,2) AS unallocated
      FROM pay
      LEFT JOIN alc ON alc.client_id = pay.client_id
    `;
    for (const r of rows) {
      const cid = sqlIntIdToNumber(r.client_id);
      if (!Number.isFinite(cid)) continue;
      out.set(cid, r.unallocated ?? new Prisma.Decimal(0));
    }
  }
  return out;
}
