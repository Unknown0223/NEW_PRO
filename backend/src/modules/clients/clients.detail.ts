import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import type { ClientListRow } from "./clients.types";
import { parseContactPersonsJson } from "./clients.helpers";
import {
  agentAssignmentSelectFields,
  mapAgentAssignmentsToApi,
  mergeAgentDisplayFromAssignments
} from "./clients.agent-assignments";
import {
  buildClientReconciliationPdfBufferFromLoaded,
  loadClientReconciliation
} from "./client-reconciliation-data";
import { getAppCache, setAppCache, invalidateClientDetailCache, clientDetailCacheKey } from "../../lib/redis-cache";
import { stableJsonStringify } from "../dashboard/dashboard.cache";
import { appendClientAuditLog } from "./clients.audit";

const CLIENT_DETAIL_CACHE_TTL_SECONDS = 30;

export type ClientDetailRow = ClientListRow & {
  phone_normalized: string | null;
  /** `cancelled` / `returned` dan tashqari zakazlar `total_sum` yig‘indisi (kredit yuki). */
  open_orders_total: string;
  /** Yetkazilgan savdo zakazlari bo‘yicha to‘lanmagan qoldiq (taqsimlangan to‘lovlardan keyin). */
  delivered_unpaid_total: string;
  updated_at: string;
  /** `client_audit_logs` bo‘yicha birinchi `client.create` */
  created_by_user_label: string | null;
  /** Oxirgi `client.patch` yozuvi */
  last_modified_by_user_label: string | null;
};

function auditActorLabel(user: { name: string; login: string } | null | undefined): string | null {
  if (!user) return null;
  const n = user.name?.trim();
  if (n) return n;
  const l = user.login?.trim();
  return l || null;
}

export async function getClientDetail(tenantId: number, id: number): Promise<ClientDetailRow> {
  const cacheKey = clientDetailCacheKey(tenantId, id);
  const cached = await getAppCache<ClientDetailRow>(cacheKey);
  if (cached) return cached;

  const [c, agg, balRow, auditPair, deliveryMap] = await Promise.all([
    prisma.client.findFirst({
      where: { id, tenant_id: tenantId, merged_into_client_id: null },
      select: {
        id: true,
        name: true,
        legal_name: true,
        phone: true,
        phone_normalized: true,
        address: true,
        category: true,
        client_type_code: true,
        credit_limit: true,
        is_active: true,
        agent_id: true,
        created_at: true,
        updated_at: true,
        responsible_person: true,
        landmark: true,
        inn: true,
        pdl: true,
        logistics_service: true,
        license_until: true,
        working_hours: true,
        region: true,
        district: true,
        city: true,
        neighborhood: true,
        street: true,
        house_number: true,
        apartment: true,
        gps_text: true,
        visit_date: true,
        notes: true,
        client_format: true,
        client_code: true,
        sales_channel: true,
        product_category_ref: true,
        bank_name: true,
        bank_account: true,
        bank_mfo: true,
        client_pinfl: true,
        oked: true,
        contract_number: true,
        vat_reg_code: true,
        latitude: true,
        longitude: true,
        zone: true,
        warehouse_id: true,
        cash_desk_id: true,
        contact_persons: true,
        agent: { select: { name: true, code: true } },
        warehouse: { select: { name: true } },
        cash_desk: { select: { name: true } },
        agent_assignments: {
          orderBy: { slot: "asc" },
          select: agentAssignmentSelectFields
        }
      }
    }),
    prisma.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: id,
        status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
      },
      _sum: { total_sum: true }
    }),
    prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: id } },
      select: { balance: true }
    }),
    Promise.all([
      prisma.clientAuditLog.findFirst({
        where: { tenant_id: tenantId, client_id: id, action: "client.create" },
        orderBy: { created_at: "asc" },
        include: { user: { select: { login: true, name: true } } }
      }),
      prisma.clientAuditLog.findFirst({
        where: { tenant_id: tenantId, client_id: id, action: "client.patch" },
        orderBy: { created_at: "desc" },
        include: { user: { select: { login: true, name: true } } }
      })
    ]),
    loadDeliveryDebtByClient(tenantId, [id])
  ]);
  const [createLog, lastPatchLog] = auditPair;
  if (!c) {
    throw new Error("NOT_FOUND");
  }
  const open_orders_total = (agg._sum.total_sum ?? new Prisma.Decimal(0)).toString();
  const ledgerBal = balRow?.balance ?? new Prisma.Decimal(0);
  const deliveryInfo = deliveryMap.get(id);
  const account_balance = mergeLedgerWithUnpaidDelivered(ledgerBal, deliveryInfo).toString();
  const delivered_unpaid_total = (deliveryInfo?.debt ?? new Prisma.Decimal(0)).toString();
  const agent_assignments = mapAgentAssignmentsToApi(c.agent_assignments);
  const visitLegacy = c.visit_date?.toISOString() ?? null;
  const disp = mergeAgentDisplayFromAssignments(
    c.agent_id,
    c.agent?.name ?? null,
    visitLegacy,
    agent_assignments
  );
  const detail: ClientDetailRow = {
    id: c.id,
    name: c.name,
    legal_name: c.legal_name,
    phone: c.phone,
    address: c.address,
    category: c.category,
    client_type_code: c.client_type_code,
    credit_limit: c.credit_limit.toString(),
    is_active: c.is_active,
    phone_normalized: c.phone_normalized,
    agent_id: disp.agent_id,
    agent_name: disp.agent_name,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
    account_balance,
    delivered_unpaid_total,
    responsible_person: c.responsible_person,
    landmark: c.landmark,
    inn: c.inn,
    pdl: c.pdl,
    logistics_service: c.logistics_service,
    license_until: c.license_until?.toISOString() ?? null,
    working_hours: c.working_hours,
    region: c.region,
    district: c.district,
    city: c.city,
    neighborhood: c.neighborhood,
    street: c.street,
    house_number: c.house_number,
    apartment: c.apartment,
    gps_text: c.gps_text,
    visit_date: disp.visit_date,
    notes: c.notes,
    client_format: c.client_format,
    client_code: c.client_code,
    sales_channel: c.sales_channel,
    product_category_ref: c.product_category_ref,
    bank_name: c.bank_name,
    bank_account: c.bank_account,
    bank_mfo: c.bank_mfo,
    client_pinfl: c.client_pinfl,
    oked: c.oked,
    contract_number: c.contract_number,
    vat_reg_code: c.vat_reg_code,
    latitude: c.latitude != null ? c.latitude.toString() : null,
    longitude: c.longitude != null ? c.longitude.toString() : null,
    zone: c.zone,
    warehouse_id: c.warehouse_id,
    warehouse_name: c.warehouse?.name ?? null,
    cash_desk_id: c.cash_desk_id,
    cash_desk_name: c.cash_desk?.name ?? null,
    agent_assignments,
    contact_persons: parseContactPersonsJson(c.contact_persons),
    open_orders_total,
    created_by_user_label: auditActorLabel(createLog?.user ?? undefined),
    last_modified_by_user_label: auditActorLabel(lastPatchLog?.user ?? undefined)
  };
  void setAppCache(cacheKey, detail, CLIENT_DETAIL_CACHE_TTL_SECONDS);
  return detail;
}

export type ClientBalanceMovementRow = {
  id: number;
  delta: string;
  note: string | null;
  user_login: string | null;
  created_at: string;
};

export async function listClientBalanceMovements(
  tenantId: number,
  clientId: number,
  page: number,
  limit: number,
  opts?: { date_from?: Date | null; date_to_end?: Date | null }
): Promise<{
  data: ClientBalanceMovementRow[];
  total: number;
  page: number;
  limit: number;
  account_balance: string;
}> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) {
    throw new Error("NOT_FOUND");
  }

  const bal = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } }
  });
  if (!bal) {
    const dm = await loadDeliveryDebtByClient(tenantId, [clientId]);
    const m = mergeLedgerWithUnpaidDelivered(new Prisma.Decimal(0), dm.get(clientId));
    return { data: [], total: 0, page, limit, account_balance: m.toString() };
  }

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (opts?.date_from) createdAt.gte = opts.date_from;
  if (opts?.date_to_end) createdAt.lte = opts.date_to_end;
  const movementWhere = {
    client_balance_id: bal.id,
    ...(Object.keys(createdAt).length > 0 ? { created_at: createdAt } : {})
  };

  const [total, rows, deliveryMap] = await Promise.all([
    prisma.clientBalanceMovement.count({ where: movementWhere }),
    prisma.clientBalanceMovement.findMany({
      where: movementWhere,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { login: true } } }
    }),
    loadDeliveryDebtByClient(tenantId, [clientId])
  ]);

  const mergedBal = mergeLedgerWithUnpaidDelivered(bal.balance, deliveryMap.get(clientId));

  return {
    data: rows.map((r) => ({
      id: r.id,
      delta: r.delta.toString(),
      note: r.note,
      user_login: r.user?.login ?? null,
      created_at: r.created_at.toISOString()
    })),
    total,
    page,
    limit,
    account_balance: mergedBal.toString()
  };
}

export async function addClientBalanceMovement(
  tenantId: number,
  clientId: number,
  delta: number,
  note: string | null | undefined,
  actorUserId: number | null
): Promise<ClientDetailRow> {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("BAD_DELTA");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) {
    throw new Error("NOT_FOUND");
  }

  const d = new Prisma.Decimal(delta);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await prisma.$transaction(async (tx) => {
    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      create: { tenant_id: tenantId, client_id: clientId, balance: d },
      update: { balance: { increment: d } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta: d,
        note: note?.trim() || null,
        user_id: uid
      }
    });
  });

  await appendClientAuditLog(tenantId, clientId, actorUserId, "client.balance_movement", {
    delta,
    note: note?.trim() || null
  });

  await invalidateClientDetailCache(tenantId, clientId);

  return getClientDetail(tenantId, clientId);
}

/**
 * Mijoz bo‘yicha akt-svercha: davr ichidagi zakazlar, to‘lovlar va hisob harakatlari + qisqacha moliyaviy ko‘rsatkichlar.
 */
export async function getClientReconciliationPdfBuffer(
  tenantId: number,
  clientId: number,
  dateFromStart: Date,
  dateToEnd: Date
): Promise<Buffer> {
  const loaded = await loadClientReconciliation(tenantId, clientId, dateFromStart, dateToEnd);
  return buildClientReconciliationPdfBufferFromLoaded(loaded);
}
