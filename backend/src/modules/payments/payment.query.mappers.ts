/**
 * Domain: Payments (kirim/chiqim, allocatsiya, batch).
 * Boundary: route → Zod + RBAC; servis → tranzaksiya, client audit, dashboard invalidatsiya.
 * Bog‘liq: `payments.route.ts`, `contracts/payments.schemas.ts`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { invalidateDashboard } from "../../lib/redis-cache";
import {
  allocatePayment,
  getPaymentAllocations,
  type AllocationMode,
  type PaymentAllocationRow
} from "./payment-allocations.service";
import type { ScopedReportActor } from "../access/access-agent-scope";
import { intersectRequestedAgentIds } from "../access/access-agent-scope";
import { buildActorPaymentGrantOr } from "../access/access-staff-scope";
import {
  parseTransferChannelFromPaymentNote,
  resolveTransferChannel
} from "../bank-transfer-inbox/bank-transfer-inbox.helpers";
import type { PaymentListQuery, PaymentListRow } from "./payment.query.types";

function splitFilterTerms(raw?: string): string[] {
  if (!raw?.trim()) return [];
  const sep = raw.includes("|") ? "|" : ",";
  return [...new Set(raw.split(sep).map((s) => s.trim()).filter(Boolean))];
}

function clientFieldContainsAny(
  field: "zone" | "region" | "city" | "district",
  raw?: string
): Prisma.ClientWhereInput | null {
  const terms = splitFilterTerms(raw);
  if (terms.length === 0) return null;
  if (terms.length === 1) {
    return { [field]: { contains: terms[0], mode: "insensitive" as const } };
  }
  return {
    OR: terms.map((t) => ({ [field]: { contains: t, mode: "insensitive" as const } }))
  };
}

export function paymentListInclude(tenantId: number): Prisma.PaymentInclude {
  return {
    client: {
      select: {
        name: true,
        legal_name: true,
        client_code: true,
        region: true,
        city: true,
        district: true,
        agent: {
          select: {
            id: true,
            name: true,
            code: true,
            trade_direction: true,
            consignment: true,
            trade_direction_row: { select: { name: true } }
          }
        },
        client_balances: {
          where: { tenant_id: tenantId },
          select: { balance: true },
          take: 1
        }
      }
    },
    order: {
      select: {
        number: true,
        expeditor_user: { select: { id: true, name: true } }
      }
    },
    cash_desk: { select: { name: true } },
    expeditor_user: { select: { id: true, name: true } },
    deleted_by: { select: { id: true, name: true } },
    edit_grants: {
      where: { status: "active" },
      orderBy: { expires_at: "desc" },
      take: 1,
      select: { expires_at: true }
    },
    bank_transfer_inbox: {
      select: { id: true, source: true },
      orderBy: { id: "desc" },
      take: 1
    }
  };
}

export function parseUtcDayStart(isoDate: string | undefined): Date | undefined {
  if (!isoDate?.trim()) return undefined;
  const d = new Date(`${isoDate.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseUtcDayEnd(isoDate: string | undefined): Date | undefined {
  if (!isoDate?.trim()) return undefined;
  const d = new Date(`${isoDate.trim()}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPaymentToListRow(r: any, tenantId: number): PaymentListRow {
  const bal = r.client.client_balances[0]?.balance ?? new Prisma.Decimal(0);
  const ag = r.client.agent as
    | {
        id: number;
        name: string;
        code: string | null;
        trade_direction: string | null;
        consignment: boolean;
        trade_direction_row: { name: string } | null;
      }
    | null
    | undefined;
  const td =
    (ag?.trade_direction && String(ag.trade_direction).trim()) ||
    ag?.trade_direction_row?.name?.trim() ||
    null;
  const exOrder = r.order?.expeditor_user as { id: number; name: string } | null | undefined;
  const exDirect = r.expeditor_user as { id: number; name: string } | null | undefined;
  const ex = exDirect ?? exOrder;
  const desk = r.cash_desk as { name: string } | null | undefined;
  const ek = String(r.entry_kind ?? "payment");
  const inboxRows = r.bank_transfer_inbox as Array<{ id: number; source: string }> | undefined;
  const inbox = Array.isArray(inboxRows) && inboxRows.length > 0 ? inboxRows[0] : null;
  const fromNote = parseTransferChannelFromPaymentNote(r.note);
  const transfer_source = inbox?.source ?? fromNote?.source ?? null;
  const transfer_channel = inbox
    ? resolveTransferChannel(inbox.source)
    : (fromNote?.channel ?? null);
  return {
    id: r.id,
    number: r.number != null && String(r.number).trim() ? String(r.number).trim() : null,
    client_id: r.client_id,
    client_name: r.client.name,
    client_legal_name: r.client.legal_name ?? null,
    client_code: r.client.client_code ?? null,
    client_balance: bal.toString(),
    order_id: r.order_id,
    order_number: r.order?.number ?? null,
    cash_desk_id: r.cash_desk_id ?? null,
    amount: r.amount.toString(),
    payment_type: r.payment_type,
    note: r.note,
    created_at: r.created_at.toISOString(),
    agent_id: ag?.id ?? null,
    agent_name: ag?.name ?? null,
    agent_code: ag?.code ?? null,
    trade_direction: td,
    consignment: ag?.consignment ?? false,
    expeditor_user_id: ex?.id ?? null,
    expeditor_name: ex?.name ?? null,
    // To'lov yozuvining o'zida ekspeditor bor bo'lsa — mobil ilovada yaratilgan.
    created_via_mobile: exDirect != null,
    cash_desk_name: desk?.name ?? null,
    payment_kind: ek === "client_expense" ? "Расход" : "Оплата",
    entry_kind: ek,
    workflow_status: String(r.workflow_status ?? "confirmed"),
    paid_at: r.paid_at ? (r.paid_at as Date).toISOString() : null,
    received_at: r.received_at ? (r.received_at as Date).toISOString() : null,
    confirmed_at: r.confirmed_at ? (r.confirmed_at as Date).toISOString() : null,
    return_expires_at:
      (r.edit_grants as { expires_at: Date }[] | undefined)?.[0]?.expires_at?.toISOString() ?? null,
    client_region: r.client.region?.trim() || null,
    client_city: r.client.city?.trim() || null,
    client_district: r.client.district?.trim() || null,
    deleted_at: r.deleted_at ? (r.deleted_at as Date).toISOString() : null,
    deleted_by_user_id: r.deleted_by_user_id ?? null,
    deleted_by_name: (r.deleted_by as { name: string } | null | undefined)?.name?.trim() || null,
    delete_reason_ref: r.delete_reason_ref?.trim() || null,
    /** Перечисление: manual | bank_verified; oddiy naqd to‘lovlarda null */
    transfer_channel,
    transfer_source,
    bank_transfer_inbox_id: inbox?.id ?? null
  };
}

export function buildPaymentListWhere(
  tenantId: number,
  q: PaymentListQuery,
  actorScope?: ScopedReportActor
): Prisma.PaymentWhereInput {
  const andParts: Prisma.PaymentWhereInput[] = [{ tenant_id: tenantId }];

  const statusList = [
    ...(q.payment_statuses ?? []),
    ...(q.payment_status && !(q.payment_statuses?.length) ? [q.payment_status] : [])
  ];
  const uniqStatuses = [...new Set(statusList)];
  const wantsDeleted = uniqStatuses.includes("deleted");
  const liveStatuses = uniqStatuses.filter((s) => s !== "deleted") as Array<
    "pending_confirmation" | "confirmed" | "rejected"
  >;

  if (uniqStatuses.length === 0) {
    andParts.push({ deleted_at: null });
  } else if (wantsDeleted && liveStatuses.length === 0) {
    andParts.push({ deleted_at: { not: null } });
  } else if (wantsDeleted && liveStatuses.length > 0) {
    andParts.push({
      OR: [
        { deleted_at: { not: null } },
        { deleted_at: null, workflow_status: { in: liveStatuses } }
      ]
    });
  } else {
    andParts.push({ deleted_at: null });
    if (liveStatuses.length === 1) {
      andParts.push({ workflow_status: liveStatuses[0] });
    } else if (liveStatuses.length > 1) {
      andParts.push({ workflow_status: { in: liveStatuses } });
    }
  }

  if (q.client_id != null && q.client_id > 0) andParts.push({ client_id: q.client_id });
  if (q.client_ids != null && q.client_ids.length > 0) {
    andParts.push({ client_id: { in: q.client_ids } });
  }
  if (q.order_id != null && q.order_id > 0) andParts.push({ order_id: q.order_id });

  const ek = q.entry_kind;
  if (ek === "client_expense") {
    andParts.push({ entry_kind: "client_expense" });
  } else {
    andParts.push({ entry_kind: "payment" });
  }

  const df = parseUtcDayStart(q.date_from);
  const dt = parseUtcDayEnd(q.date_to);
  if (df || dt) {
    const field = q.date_field === "paid_at" ? "paid_at" : q.date_field === "confirmed_at" ? "confirmed_at" : "created_at";
    andParts.push({
      [field]: {
        ...(df ? { gte: df } : {}),
        ...(dt ? { lte: dt } : {})
      }
    } as Prisma.PaymentWhereInput);
  }

  if (q.amount_min != null || q.amount_max != null) {
    const decMin =
      q.amount_min != null && Number.isFinite(q.amount_min) ? new Prisma.Decimal(q.amount_min) : undefined;
    const decMax =
      q.amount_max != null && Number.isFinite(q.amount_max) ? new Prisma.Decimal(q.amount_max) : undefined;
    andParts.push({
      amount: {
        ...(decMin != null ? { gte: decMin } : {}),
        ...(decMax != null ? { lte: decMax } : {})
      }
    });
  }

  if (q.payment_types != null && q.payment_types.length > 0) {
    andParts.push({ payment_type: { in: q.payment_types.map((t) => t.trim()).filter(Boolean) } });
  } else if (q.payment_type != null && q.payment_type.trim() !== "" && q.payment_type !== "__all__") {
    andParts.push({ payment_type: q.payment_type.trim() });
  }

  if (q.expeditor_user_ids != null && q.expeditor_user_ids.length > 0) {
    andParts.push({
      OR: [
        { order: { expeditor_user_id: { in: q.expeditor_user_ids } } },
        { expeditor_user_id: { in: q.expeditor_user_ids } }
      ]
    });
  } else if (q.expeditor_user_id != null && q.expeditor_user_id > 0) {
    const exId = q.expeditor_user_id;
    andParts.push({
      OR: [{ order: { expeditor_user_id: exId } }, { expeditor_user_id: exId }]
    });
  }

  const clientAnd: Prisma.ClientWhereInput[] = [];

  const requestedAgentIds = [
    ...(q.agent_ids ?? []).filter((n) => Number.isFinite(n) && n > 0),
    ...(q.agent_id != null && q.agent_id > 0 ? [q.agent_id] : [])
  ];
  let scopedAgentIds = [...new Set(requestedAgentIds)];
  if (actorScope) {
    const hit = intersectRequestedAgentIds(scopedAgentIds, actorScope);
    if (hit.restricted) {
      scopedAgentIds = hit.agentIds;
      if (scopedAgentIds.length === 0) {
        const grantOr = buildActorPaymentGrantOr(actorScope);
        andParts.push(grantOr ?? { id: { in: [] } });
      }
    }
  }
  if (scopedAgentIds.length > 0) {
    clientAnd.push({
      OR: [
        { agent_id: { in: scopedAgentIds } },
        { agent_assignments: { some: { agent_id: { in: scopedAgentIds } } } }
      ]
    });
  }

  if (q.trade_directions != null && q.trade_directions.length > 0) {
    clientAnd.push({
      OR: q.trade_directions.map((tdRaw) => {
        const td = tdRaw.trim();
        return {
          agent: {
            OR: [
              { trade_direction: { contains: td, mode: "insensitive" as const } },
              { trade_direction_row: { name: { contains: td, mode: "insensitive" as const } } }
            ]
          }
        };
      })
    });
  } else if (q.trade_direction != null && q.trade_direction.trim() !== "" && q.trade_direction !== "__all__") {
    const td = q.trade_direction.trim();
    clientAnd.push({
      agent: {
        OR: [
          { trade_direction: { contains: td, mode: "insensitive" } },
          { trade_direction_row: { name: { contains: td, mode: "insensitive" } } }
        ]
      }
    });
  }

  const regionClause = clientFieldContainsAny("region", q.territory_region);
  if (regionClause) clientAnd.push(regionClause);
  const cityClause = clientFieldContainsAny("city", q.territory_city);
  if (cityClause) clientAnd.push(cityClause);
  const districtClause = clientFieldContainsAny("district", q.territory_district);
  if (districtClause) clientAnd.push(districtClause);
  const zoneClause = clientFieldContainsAny("zone", q.territory_zone);
  if (zoneClause) clientAnd.push(zoneClause);

  if (q.deal_type === "regular") {
    clientAnd.push({
      OR: [{ agent_id: null }, { agent: { is: { consignment: false } } }]
    });
  } else if (q.deal_type === "consignment") {
    clientAnd.push({ agent: { is: { consignment: true } } });
  }

  if (clientAnd.length) {
    andParts.push({ client: { AND: clientAnd } });
  }

  if (q.search?.trim()) {
    const s = q.search.trim();
    const idNum = Number.parseInt(s, 10);
    const orSearch: Prisma.PaymentWhereInput[] = [
      { client: { name: { contains: s, mode: "insensitive" } } },
      { client: { legal_name: { contains: s, mode: "insensitive" } } },
      { client: { client_code: { contains: s, mode: "insensitive" } } }
    ];
    if (Number.isFinite(idNum) && idNum > 0) {
      orSearch.push({ id: idNum });
    }
    andParts.push({ OR: orSearch });
  }

  // workflow_status already applied via payment_statuses / payment_status above.

  const ch = q.application_channel;
  if (ch === "expeditor") {
    // Faqat ekspeditor mobil ilovasida yaratilgan to'lovlar (to'lov yozuvining
    // o'zida expeditor_user_id bor). Operator/kassir web orqali kiritgan
    // to'lovlar (zakaz ekspeditorga biriktirilgan bo'lsa ham) bu yerga tushmaydi.
    andParts.push({ expeditor_user_id: { not: null } });
  } else if (ch === "collector") {
    andParts.push({
      OR: [
        { note: { contains: "инкасс", mode: "insensitive" } },
        { note: { contains: "inkass", mode: "insensitive" } },
        { payment_type: { contains: "inkass", mode: "insensitive" } },
        { payment_type: { contains: "инкасс", mode: "insensitive" } },
        { payment_type: { contains: "collector", mode: "insensitive" } }
      ]
    });
  } else if (ch === "van") {
    andParts.push({
      OR: [
        { note: { contains: "van-selling", mode: "insensitive" } },
        {
          client: {
            agent: {
              is: {
                OR: [
                  { trade_direction: { contains: "van", mode: "insensitive" } },
                  { trade_direction_row: { name: { contains: "van", mode: "insensitive" } } }
                ]
              }
            }
          }
        }
      ]
    });
  } else if (ch === "bank") {
    andParts.push({
      OR: [
        { payment_type: { contains: "perech", mode: "insensitive" } },
        { payment_type: { contains: "перечис", mode: "insensitive" } },
        { payment_type: { contains: "bank", mode: "insensitive" } },
        { payment_type: { contains: "transfer", mode: "insensitive" } },
        { note: { contains: "банк", mode: "insensitive" } },
        { note: { contains: "bank", mode: "insensitive" } }
      ]
    });
  }

  if (q.transfer_channel === "manual") {
    andParts.push({ bank_transfer_inbox: { some: { source: "manual" } } });
  } else if (q.transfer_channel === "bank_verified") {
    andParts.push({
      bank_transfer_inbox: {
        some: { source: { in: ["excel", "csv", "bank_api", "one_c"] } }
      }
    });
  }

  if (q.cash_desk_ids != null && q.cash_desk_ids.length > 0) {
    andParts.push({ cash_desk_id: { in: q.cash_desk_ids } });
  }
  if (q.warehouse_ids != null && q.warehouse_ids.length > 0) {
    andParts.push({ order: { warehouse_id: { in: q.warehouse_ids } } });
  }

  return andParts.length === 1 ? andParts[0]! : { AND: andParts };
}
