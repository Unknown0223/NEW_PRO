import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";

export type SalesReturnListRow = {
  id: number;
  number: string;
  client_id: number | null;
  client_name: string | null;
  order_id: number | null;
  order_number: string | null;
  warehouse_id: number;
  warehouse_name: string;
  status: string;
  refund_amount: string | null;
  note: string | null;
  refusal_reason_ref: string | null;
  created_at: string;
  /** Kim yaratdi (ekspeditor/operator) */
  created_by_name: string | null;
  created_by_role: string | null;
  /** web (operator) | mobile (ekspeditor) — manba kanali */
  creation_channel: "web" | "mobile";
  /** Zavsklad qabul qilgan vaqt (posted bo'lsa) */
  accepted_at: string | null;
};

function returnCreationChannel(role: string | null | undefined): "web" | "mobile" {
  const r = (role ?? "").toLowerCase();
  if (r.includes("agent") || r.includes("expeditor")) return "mobile";
  return "web";
}

const salesReturnRowInclude = {
  client: { select: { name: true } },
  order: { select: { number: true } },
  warehouse: { select: { name: true } },
  created_by: { select: { name: true, login: true, role: true } }
} as const;

function mapSalesReturnRow(r: {
  id: number;
  number: string;
  client_id: number | null;
  order_id: number | null;
  warehouse_id: number;
  status: string;
  refund_amount: Prisma.Decimal | null;
  note: string | null;
  refusal_reason_ref: string | null;
  created_at: Date;
  accepted_at: Date | null;
  client: { name: string } | null;
  order: { number: string } | null;
  warehouse: { name: string };
  created_by: { name: string | null; login: string | null; role: string | null } | null;
}): SalesReturnListRow {
  return {
    id: r.id,
    number: r.number,
    client_id: r.client_id,
    client_name: r.client?.name ?? null,
    order_id: r.order_id,
    order_number: r.order?.number ?? null,
    warehouse_id: r.warehouse_id,
    warehouse_name: r.warehouse.name,
    status: r.status,
    refund_amount: r.refund_amount?.toString() ?? null,
    note: r.note,
    refusal_reason_ref: r.refusal_reason_ref ?? null,
    created_at: r.created_at.toISOString(),
    created_by_name: r.created_by?.name?.trim() || r.created_by?.login?.trim() || null,
    created_by_role: r.created_by?.role ?? null,
    creation_channel: returnCreationChannel(r.created_by?.role),
    accepted_at: r.accepted_at?.toISOString() ?? null
  };
}

export type SalesReturnDetailRow = SalesReturnListRow & {
  created_by_user_id: number | null;
  lines: {
    id: number;
    product_id: number;
    product_sku: string;
    product_name: string;
    qty: string;
    paid_qty: string | null;
    bonus_qty: string | null;
  }[];
};

export async function listSalesReturns(
  tenantId: number,
  q: {
    page: number;
    limit: number;
    warehouse_id?: number;
    client_id?: number;
    status?: string;
    warehouse_ids?: number[];
    client_ids?: number[];
  }
): Promise<{ data: SalesReturnListRow[]; total: number; page: number; limit: number }> {
  const where: Prisma.SalesReturnWhereInput = { tenant_id: tenantId };
  if (q.status != null && q.status.trim()) where.status = q.status.trim();
  if (q.warehouse_id != null && q.warehouse_id > 0) where.warehouse_id = q.warehouse_id;
  if (q.client_id != null && q.client_id > 0) where.client_id = q.client_id;
  if (q.warehouse_ids != null && q.warehouse_ids.length > 0) where.warehouse_id = { in: q.warehouse_ids };
  if (q.client_ids != null && q.client_ids.length > 0) where.client_id = { in: q.client_ids };

  const [total, rows] = await Promise.all([
    prisma.salesReturn.count({ where }),
    prisma.salesReturn.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: salesReturnRowInclude
    })
  ]);

  return {
    total,
    page: q.page,
    limit: q.limit,
    data: rows.map(mapSalesReturnRow)
  };
}

export async function listSalesReturnsForOrder(tenantId: number, orderId: number): Promise<SalesReturnListRow[]> {
  const rows = await prisma.salesReturn.findMany({
    where: { tenant_id: tenantId, order_id: orderId },
    orderBy: { created_at: "desc" },
    include: salesReturnRowInclude
  });
  return rows.map(mapSalesReturnRow);
}

export async function getSalesReturnById(
  tenantId: number,
  id: number
): Promise<SalesReturnDetailRow | null> {
  const row = await prisma.salesReturn.findFirst({
    where: { tenant_id: tenantId, id },
    include: {
      ...salesReturnRowInclude,
      lines: {
        orderBy: [{ id: "asc" }],
        include: {
          product: { select: { sku: true, name: true } }
        }
      }
    }
  });
  if (!row) return null;
  return {
    ...mapSalesReturnRow(row),
    created_by_user_id: row.created_by_user_id,
    lines: row.lines.map((ln) => ({
      id: ln.id,
      product_id: ln.product_id,
      product_sku: ln.product.sku,
      product_name: ln.product.name,
      qty: ln.qty.toString(),
      paid_qty: ln.paid_qty?.toString() ?? null,
      bonus_qty: ln.bonus_qty?.toString() ?? null
    }))
  };
}

export type CreateSalesReturnInput = {
  warehouse_id: number;
  client_id?: number | null;
  order_id?: number | null;
  price_type?: string | null;
  refund_amount?: number | null;
  note?: string | null;
  refusal_reason_ref?: string | null;
  lines: { product_id: number; qty: number }[];
};

export async function createSalesReturn(
  tenantId: number,
  input: CreateSalesReturnInput,
  actorUserId: number | null
): Promise<SalesReturnListRow> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");

  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  let clientId: number | null = input.client_id != null && input.client_id > 0 ? input.client_id : null;
  if (clientId != null) {
    const c = await prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null }
    });
    if (!c) throw new Error("BAD_CLIENT");
  }

  let orderId: number | null = input.order_id != null && input.order_id > 0 ? input.order_id : null;
  if (orderId != null) {
    const ord = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId }
    });
    if (!ord) throw new Error("BAD_ORDER");
    if (clientId == null) clientId = ord.client_id;
    if (clientId != null && ord.client_id !== clientId) throw new Error("BAD_ORDER_CLIENT");
  }

  const productIds = [...new Set(input.lines.map((l) => l.product_id))];
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: productIds }, is_active: true }
  });
  if (products.length !== productIds.length) throw new Error("BAD_PRODUCT");

  const returnPriceType = (input.price_type ?? "").trim() || "retail";
  await assertReturnProductsInterchangeableStrict(tenantId, productIds, returnPriceType);

  const refund =
    input.refund_amount != null && Number.isFinite(input.refund_amount) && input.refund_amount > 0
      ? new Prisma.Decimal(input.refund_amount)
      : null;

  if (refund != null && (clientId == null || clientId < 1)) {
    throw new Error("REFUND_NEEDS_CLIENT");
  }

  for (const line of input.lines) {
    if (!Number.isFinite(line.qty) || line.qty <= 0) throw new Error("BAD_QTY");
  }

  const number = `R-${tenantId}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  const row = await prisma.$transaction(async (tx) => {
    const ret = await tx.salesReturn.create({
      data: {
        tenant_id: tenantId,
        number,
        client_id: clientId,
        order_id: orderId,
        warehouse_id: input.warehouse_id,
        // Zavsklad qabulini kutadi — ostatka/balans qabulda qo'llanadi.
        status: "pending",
        refund_amount: refund,
        note: input.note?.trim() || null,
        refusal_reason_ref:
          input.refusal_reason_ref != null && String(input.refusal_reason_ref).trim()
            ? String(input.refusal_reason_ref).trim().slice(0, 128)
            : null,
        created_by_user_id: uid,
        lines: {
          create: input.lines.map((l) => ({
            product_id: l.product_id,
            qty: new Prisma.Decimal(l.qty)
          }))
        }
      }
    });

    return tx.salesReturn.findFirstOrThrow({
      where: { id: ret.id },
      include: salesReturnRowInclude
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: String(input.warehouse_id),
    action: "sales_return",
    payload: { return_id: row.id, number: row.number, line_count: input.lines.length }
  });

  // Per-return tarix uchun aniq (entity = return id) audit yozuvi.
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_return",
    entityId: String(row.id),
    action: "return.create",
    payload: {
      return_id: row.id,
      number: row.number,
      client_id: row.client_id,
      order_id: row.order_id,
      warehouse_id: input.warehouse_id,
      line_count: input.lines.length,
      refund: refund?.toString() ?? null
    }
  });

  if (clientId != null) {
    await appendClientAuditLog(tenantId, clientId, actorUserId, "client.sales_return", {
      return_id: row.id,
      number: row.number,
      refund: refund?.toString() ?? null
    });
  }

  return mapSalesReturnRow(row);
}
