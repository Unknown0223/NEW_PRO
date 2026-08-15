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
  /** Bitta mijoz — aniq; turli mijozlar — `null` (jadvalda har qator o‘z mijozini ko‘rsatadi). */
  client: { id: number; name: string } | null;
  clients_count: number;
  payment_methods: OrderCashInPaymentMethodDto[];
  orders: OrderCashInOrderDto[];
};

export type OrderCashInLineInput = {
  order_id: number;
  payment_type: string;
  amount: number;
};

export type CreateOrderCashInInput = {
  client_id?: number | null;
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
  input: { client_id?: number; order_ids?: number[] }
): Promise<OrderCashInContextDto> {
  const orderIdFilter = [...new Set((input.order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0))];
  const clientId =
    input.client_id != null && Number.isFinite(input.client_id) && input.client_id > 0
      ? input.client_id
      : null;

  if (!clientId && orderIdFilter.length === 0) {
    throw new Error("BAD_CLIENT");
  }

  let scopedClient: { id: number; name: string } | null = null;
  if (clientId != null) {
    scopedClient = await prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
      select: { id: true, name: true }
    });
    if (!scopedClient) throw new Error("BAD_CLIENT");
  }

  type CashInOrderSrc = {
    id: number;
    client_id: number;
    client_name: string;
    status: string;
    total_sum: string;
    debt: string | null;
  };

  let orders: CashInOrderSrc[];

  if (orderIdFilter.length > 0) {
    const dbOrders = await prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        id: { in: orderIdFilter },
        ...(clientId != null ? { client_id: clientId } : {})
      },
      select: {
        id: true,
        client_id: true,
        status: true,
        total_sum: true,
        client: { select: { name: true } }
      }
    });
    const byId = new Map(dbOrders.map((o) => [o.id, o]));
    orders = orderIdFilter
      .map((id) => byId.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o))
      .map((o) => ({
        id: o.id,
        client_id: o.client_id,
        client_name: o.client.name,
        status: o.status,
        total_sum: o.total_sum.toFixed(2),
        debt: null
      }));
  } else {
    if (clientId == null || !scopedClient) throw new Error("BAD_CLIENT");
    const list = await listOrdersPaged(
      tenantId,
      {
        page: 1,
        limit: 500,
        client_id: clientId,
        status: "delivered"
      },
      "admin",
      null
    );
    orders = list.data.map((o) => ({
      id: o.id,
      client_id: o.client_id,
      client_name: o.client_name,
      status: o.status,
      total_sum: o.total_sum,
      debt: o.debt ?? null
    }));
  }

  const existingMap = await aggregateExistingPaymentsByOrder(
    tenantId,
    orders.map((o) => o.id)
  );

  const { methods } = await loadAllowedPaymentTypes(tenantId);
  const clientIds = [...new Set(orders.map((o) => o.client_id))];
  const clientsCount = clientIds.length;
  const clientDto =
    clientsCount === 1
      ? scopedClient && scopedClient.id === clientIds[0]
        ? scopedClient
        : { id: orders[0]!.client_id, name: orders[0]!.client_name }
      : null;

  return {
    client: clientDto,
    clients_count: clientsCount,
    payment_methods: methods,
    orders: orders.map((o) => {
      const existing = existingMap.get(o.id);
      let paid = new Prisma.Decimal(0);
      if (existing) {
        for (const v of Object.values(existing)) paid = paid.add(v);
      }
      const total = new Prisma.Decimal(o.total_sum);
      const remain = total.sub(paid);
      const debt =
        o.debt ??
        (remain.gt(0) ? remain.toFixed(2) : "0.00");
      return {
        id: o.id,
        client_id: o.client_id,
        client_name: o.client_name,
        status: o.status,
        order_amount: o.total_sum,
        debt,
        existing_by_type: decMapToStrings(existing)
      };
    })
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

  const lines = input.lines.filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  if (lines.length === 0) throw new Error("NO_LINES");

  const orderIds = [...new Set(lines.map((l) => l.order_id))];
  const orders = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: orderIds },
      ...(input.client_id != null && input.client_id > 0
        ? { client_id: input.client_id }
        : {})
    },
    select: { id: true, client_id: true, is_consignment: true }
  });
  const orderById = new Map(orders.map((o) => [o.id, o]));

  for (const l of lines) {
    if (!orderById.has(l.order_id)) throw new Error("BAD_ORDER");
    const pt = l.payment_type.trim();
    if (!pt || !allowed.has(pt)) throw new Error("BAD_PAYMENT_TYPE");
  }

  const paymentIds: number[] = [];

  for (const line of lines) {
    const order = orderById.get(line.order_id)!;
    const row = await createPayment(
      tenantId,
      {
        client_id: order.client_id,
        order_id: line.order_id,
        amount: line.amount,
        payment_type: line.payment_type.trim(),
        cash_desk_id: input.cash_desk_id ?? null,
        paid_at: input.paid_at ?? null,
        allocation_mode: order.is_consignment === true ? "consignment" : "cash",
        allocation_order_ids: [line.order_id]
      },
      actorUserId
    );
    paymentIds.push(row.id);
  }

  void invalidateDashboard(tenantId);

  return { created_count: paymentIds.length, payment_ids: paymentIds };
}
