/**
 * «Приход в кассу» — zakazlar bo‘yicha to‘lov (tenant to‘lov usullari katalogi bilan).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateDashboard } from "../../lib/redis-cache";
import { listOrdersPaged } from "../orders/orders.service";
import {
  paymentMethodStorageKey,
  paymentTypeStorageKeysFromMethodEntries,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../tenant-settings/tenant-settings.profile.read";
import { createPayment } from "./payment.create";

export type OrderCashInPaymentMethodDto = {
  id: string;
  name: string;
  code: string | null;
  payment_type: string;
  currency_code: string;
  color: string | null;
  sort_order: number | null;
};

export type OrderCashInOrderDto = {
  id: number;
  client_id: number;
  client_name: string;
  status: string;
  order_amount: string;
  debt: string | null;
  /** Mavjud to‘lovlar: `payment_type` → summa (string decimal). */
  existing_by_type: Record<string, string>;
};

export type OrderCashInContextDto = {
  client: { id: number; name: string };
  payment_methods: OrderCashInPaymentMethodDto[];
  orders: OrderCashInOrderDto[];
};

export type OrderCashInLineInput = {
  order_id: number;
  payment_type: string;
  amount: number;
};

export type CreateOrderCashInInput = {
  client_id: number;
  cash_desk_id?: number | null;
  paid_at?: string | null;
  lines: OrderCashInLineInput[];
};

function mapPaymentMethods(entries: PaymentMethodEntryDto[]): OrderCashInPaymentMethodDto[] {
  return entries
    .filter((e) => e.active !== false)
    .map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code,
      payment_type: paymentMethodStorageKey(e),
      currency_code: e.currency_code,
      color: e.color,
      sort_order: e.sort_order
    }));
}

async function loadAllowedPaymentTypes(tenantId: number): Promise<{
  methods: OrderCashInPaymentMethodDto[];
  allowed: Set<string>;
}> {
  const entries = await loadPaymentMethodEntriesForResolve(tenantId);
  const methods = mapPaymentMethods(entries);
  const keys = paymentTypeStorageKeysFromMethodEntries(entries);
  return { methods, allowed: new Set(keys) };
}

async function aggregateExistingPaymentsByOrder(
  tenantId: number,
  orderIds: number[]
): Promise<Map<number, Record<string, Prisma.Decimal>>> {
  const out = new Map<number, Record<string, Prisma.Decimal>>();
  if (orderIds.length === 0) return out;

  const rows = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      order_id: { in: orderIds },
      deleted_at: null,
      entry_kind: "payment"
    },
    select: { order_id: true, payment_type: true, amount: true }
  });

  for (const r of rows) {
    const oid = r.order_id;
    if (oid == null || oid < 1) continue;
    const pt = r.payment_type.trim();
    if (!pt) continue;
    let bucket = out.get(oid);
    if (!bucket) {
      bucket = {};
      out.set(oid, bucket);
    }
    bucket[pt] = (bucket[pt] ?? new Prisma.Decimal(0)).add(r.amount);
  }
  return out;
}

function decMapToStrings(m: Record<string, Prisma.Decimal> | undefined): Record<string, string> {
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) {
    out[k] = v.toFixed(2);
  }
  return out;
}

export async function getOrderCashInContext(
  tenantId: number,
  input: { client_id: number; order_ids?: number[] }
): Promise<OrderCashInContextDto> {
  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true, name: true }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const orderIdFilter = (input.order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0);
  const list = await listOrdersPaged(
    tenantId,
    {
      page: 1,
      limit: 500,
      client_id: input.client_id,
      ...(orderIdFilter.length === 0 ? { status: "delivered" } : {})
    },
    "admin",
    null
  );

  let orders = list.data;
  if (orderIdFilter.length > 0) {
    const idSet = new Set(orderIdFilter);
    orders = orders.filter((o) => idSet.has(o.id));
  }

  const existingMap = await aggregateExistingPaymentsByOrder(
    tenantId,
    orders.map((o) => o.id)
  );

  const { methods } = await loadAllowedPaymentTypes(tenantId);

  return {
    client: { id: client.id, name: client.name },
    payment_methods: methods,
    orders: orders.map((o) => ({
      id: o.id,
      client_id: o.client_id,
      client_name: o.client_name,
      status: o.status,
      order_amount: o.total_sum,
      debt: o.debt ?? null,
      existing_by_type: decMapToStrings(existingMap.get(o.id))
    }))
  };
}

export type CreateOrderCashInResult = {
  created_count: number;
  payment_ids: number[];
};

export async function createOrderCashInBatch(
  tenantId: number,
  input: CreateOrderCashInInput,
  actorUserId: number | null
): Promise<CreateOrderCashInResult> {
  const { allowed } = await loadAllowedPaymentTypes(tenantId);

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const lines = input.lines.filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  if (lines.length === 0) throw new Error("NO_LINES");

  const orderIds = [...new Set(lines.map((l) => l.order_id))];
  const orders = await prisma.order.findMany({
    where: { tenant_id: tenantId, client_id: input.client_id, id: { in: orderIds } },
    select: { id: true, is_consignment: true }
  });
  const orderSet = new Set(orders.map((o) => o.id));
  const consignmentByOrder = new Map(orders.map((o) => [o.id, o.is_consignment === true]));

  for (const l of lines) {
    if (!orderSet.has(l.order_id)) throw new Error("BAD_ORDER");
    const pt = l.payment_type.trim();
    if (!pt || !allowed.has(pt)) throw new Error("BAD_PAYMENT_TYPE");
  }

  const paymentIds: number[] = [];

  for (const line of lines) {
    const row = await createPayment(
      tenantId,
      {
        client_id: input.client_id,
        order_id: line.order_id,
        amount: line.amount,
        payment_type: line.payment_type.trim(),
        cash_desk_id: input.cash_desk_id ?? null,
        paid_at: input.paid_at ?? null,
        allocation_mode: consignmentByOrder.get(line.order_id) ? "consignment" : "cash",
        allocation_order_ids: [line.order_id]
      },
      actorUserId
    );
    paymentIds.push(row.id);
  }

  void invalidateDashboard(tenantId);

  return { created_count: paymentIds.length, payment_ids: paymentIds };
}
