import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { sqlOrderMerchandiseNetReceivable } from "../order-merchandise-net";
import { bulkUpdateOrderConsignment } from "./order.lifecycle";

export const CONSIGNMENT_COMMENT_FIELD_KEYS = [
  "order_number",
  "client",
  "agent",
  "expeditor",
  "payment_method",
  "total_sum",
  "delivered_at",
  "days_overdue",
  "unpaid",
  "conditions"
] as const;

export type ConsignmentCommentFieldKey = (typeof CONSIGNMENT_COMMENT_FIELD_KEYS)[number];

export type ConsignmentAutoSettings = {
  /** Доставлен sanasidan keyin shuncha kun */
  days_after_delivered: number;
  /** Modalda default belgilangan kommentariya maydonlari */
  comment_fields: ConsignmentCommentFieldKey[];
};

const DEFAULT_COMMENT_FIELDS: ConsignmentCommentFieldKey[] = [
  "order_number",
  "client",
  "agent",
  "expeditor",
  "payment_method",
  "total_sum",
  "delivered_at",
  "days_overdue",
  "unpaid",
  "conditions"
];

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeCommentFields(raw: unknown): ConsignmentCommentFieldKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_COMMENT_FIELDS];
  const allowed = new Set<string>(CONSIGNMENT_COMMENT_FIELD_KEYS);
  const out: ConsignmentCommentFieldKey[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const k = x.trim();
    if (!allowed.has(k)) continue;
    if (!out.includes(k as ConsignmentCommentFieldKey)) out.push(k as ConsignmentCommentFieldKey);
  }
  return out.length > 0 ? out : [...DEFAULT_COMMENT_FIELDS];
}

export function parseConsignmentAutoSettings(
  settings: Prisma.JsonValue | null | undefined
): ConsignmentAutoSettings {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  const rawDays = cons.auto_transfer_days;
  const n =
    typeof rawDays === "number"
      ? rawDays
      : typeof rawDays === "string"
        ? Number.parseInt(rawDays, 10)
        : NaN;
  const days = Number.isInteger(n) && n >= 1 && n <= 365 ? n : 3;
  return {
    days_after_delivered: days,
    comment_fields: normalizeCommentFields(cons.auto_transfer_comment_fields)
  };
}

export function patchConsignmentAutoSettingsJson(
  settings: Prisma.JsonValue | null | undefined,
  patch: { days_after_delivered?: number; comment_fields?: ConsignmentCommentFieldKey[] }
): Prisma.InputJsonValue {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  const next = { ...cons };
  if (patch.days_after_delivered != null) {
    next.auto_transfer_days = patch.days_after_delivered;
  }
  if (patch.comment_fields != null) {
    next.auto_transfer_comment_fields = patch.comment_fields;
  }
  return { ...root, consignment: next } as Prisma.InputJsonValue;
}

export async function getConsignmentAutoSettings(tenantId: number): Promise<ConsignmentAutoSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  return parseConsignmentAutoSettings(tenant?.settings);
}

export async function patchConsignmentAutoSettings(
  tenantId: number,
  patch: { days_after_delivered?: number; comment_fields?: ConsignmentCommentFieldKey[] }
): Promise<ConsignmentAutoSettings> {
  if (patch.days_after_delivered != null) {
    const d = patch.days_after_delivered;
    if (!Number.isInteger(d) || d < 1 || d > 365) throw new Error("BAD_AUTO_DAYS");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: patchConsignmentAutoSettingsJson(tenant.settings, patch) }
  });
  return getConsignmentAutoSettings(tenantId);
}

export type ConsignmentAutoCandidate = {
  id: number;
  number: string;
  status: string;
  total_sum: string;
  unpaid: string;
  payment_method_ref: string | null;
  client_id: number;
  client_name: string;
  agent_id: number | null;
  agent_name: string | null;
  expeditor_id: number | null;
  expeditor_name: string | null;
  delivered_at: string;
  days_since_delivered: number;
  comment: string | null;
};

function personName(u: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  login?: string | null;
} | null | undefined): string | null {
  if (!u) return null;
  const composed = [u.last_name, u.first_name].filter(Boolean).join(" ").trim();
  return (composed || u.name || u.login || "").trim() || null;
}

/** Доставлен + konsignatsiyasiz + N kundan oshgan (to‘liq to‘lanmagan). */
export async function listConsignmentAutoCandidates(
  tenantId: number,
  input: { page: number; page_size: number; search?: string; days_after_delivered?: number }
): Promise<{
  rows: ConsignmentAutoCandidate[];
  total: number;
  page: number;
  page_size: number;
  days_after_delivered: number;
}> {
  const settings = await getConsignmentAutoSettings(tenantId);
  const days = input.days_after_delivered ?? settings.days_after_delivered;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const search = input.search?.trim() || "";
  const page = input.page;
  const page_size = input.page_size;
  const offset = (page - 1) * page_size;

  type Raw = {
    id: number;
    number: string;
    status: string;
    total_sum: Prisma.Decimal;
    unpaid: Prisma.Decimal;
    payment_method_ref: string | null;
    client_id: number;
    client_name: string;
    agent_id: number | null;
    agent_name: string | null;
    agent_login: string | null;
    agent_first: string | null;
    agent_last: string | null;
    expeditor_id: number | null;
    expeditor_name: string | null;
    expeditor_login: string | null;
    expeditor_first: string | null;
    expeditor_last: string | null;
    delivered_at: Date;
    comment: string | null;
  };

  const searchSql = search
    ? Prisma.sql`AND (
        o.number ILIKE ${"%" + search + "%"}
        OR c.name ILIKE ${"%" + search + "%"}
        OR COALESCE(o.comment, '') ILIKE ${"%" + search + "%"}
      )`
    : Prisma.empty;

  const countRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    del AS (
      SELECT sl.order_id, MIN(sl.created_at) AS delivered_at
      FROM order_status_logs sl
      INNER JOIN orders ox ON ox.id = sl.order_id AND ox.tenant_id = ${tenantId}
      WHERE sl.to_status = 'delivered'
      GROUP BY sl.order_id
    )
    SELECT COUNT(*)::bigint AS cnt
    FROM orders o
    INNER JOIN del d ON d.order_id = o.id
    LEFT JOIN alloc a ON a.order_id = o.id
    INNER JOIN clients c ON c.id = o.client_id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.status = 'delivered'
      AND o.is_consignment = false
      AND d.delivered_at <= ${cutoff}
      AND GREATEST(${sqlOrderMerchandiseNetReceivable("o")} - COALESCE(a.sum_amt, 0), 0) > 0
      ${searchSql}
  `;

  const total = Number(countRows[0]?.cnt ?? 0n);

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    del AS (
      SELECT sl.order_id, MIN(sl.created_at) AS delivered_at
      FROM order_status_logs sl
      INNER JOIN orders ox ON ox.id = sl.order_id AND ox.tenant_id = ${tenantId}
      WHERE sl.to_status = 'delivered'
      GROUP BY sl.order_id
    )
    SELECT
      o.id,
      o.number,
      o.status,
      o.total_sum,
      GREATEST(${sqlOrderMerchandiseNetReceivable("o")} - COALESCE(a.sum_amt, 0), 0)::decimal(15,2) AS unpaid,
      o.payment_method_ref,
      o.client_id,
      c.name AS client_name,
      o.agent_id,
      ag.name AS agent_name,
      ag.login AS agent_login,
      ag.first_name AS agent_first,
      ag.last_name AS agent_last,
      o.expeditor_user_id AS expeditor_id,
      ex.name AS expeditor_name,
      ex.login AS expeditor_login,
      ex.first_name AS expeditor_first,
      ex.last_name AS expeditor_last,
      d.delivered_at,
      o.comment
    FROM orders o
    INNER JOIN del d ON d.order_id = o.id
    LEFT JOIN alloc a ON a.order_id = o.id
    INNER JOIN clients c ON c.id = o.client_id
    LEFT JOIN users ag ON ag.id = o.agent_id
    LEFT JOIN users ex ON ex.id = o.expeditor_user_id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.status = 'delivered'
      AND o.is_consignment = false
      AND d.delivered_at <= ${cutoff}
      AND GREATEST(${sqlOrderMerchandiseNetReceivable("o")} - COALESCE(a.sum_amt, 0), 0) > 0
      ${searchSql}
    ORDER BY d.delivered_at ASC, o.id ASC
    LIMIT ${page_size} OFFSET ${offset}
  `;

  const now = Date.now();
  return {
    total,
    page,
    page_size,
    days_after_delivered: days,
    rows: rows.map((r) => {
      const deliveredMs = new Date(r.delivered_at).getTime();
      const daysSince = Math.max(0, Math.floor((now - deliveredMs) / (24 * 60 * 60 * 1000)));
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        total_sum: r.total_sum.toString(),
        unpaid: r.unpaid.toString(),
        payment_method_ref: r.payment_method_ref,
        client_id: r.client_id,
        client_name: r.client_name,
        agent_id: r.agent_id,
        agent_name: personName({
          name: r.agent_name,
          first_name: r.agent_first,
          last_name: r.agent_last,
          login: r.agent_login
        }),
        expeditor_id: r.expeditor_id,
        expeditor_name: personName({
          name: r.expeditor_name,
          first_name: r.expeditor_first,
          last_name: r.expeditor_last,
          login: r.expeditor_login
        }),
        delivered_at: new Date(r.delivered_at).toISOString(),
        days_since_delivered: daysSince,
        comment: r.comment
      };
    })
  };
}

function formatMoney(v: string): string {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatDtRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function buildConsignmentAutoCommentParts(
  row: ConsignmentAutoCandidate,
  fields: ConsignmentCommentFieldKey[],
  freeConditions?: string | null
): string {
  const parts: string[] = [];
  for (const f of fields) {
    switch (f) {
      case "order_number":
        parts.push(`Заказ: ${row.number}`);
        break;
      case "client":
        parts.push(`Клиент: ${row.client_name}`);
        break;
      case "agent":
        parts.push(`Агент: ${row.agent_name ?? "—"}`);
        break;
      case "expeditor":
        parts.push(`Экспедитор: ${row.expeditor_name ?? "—"}`);
        break;
      case "payment_method":
        parts.push(`Оплата: ${row.payment_method_ref ?? "—"}`);
        break;
      case "total_sum":
        parts.push(`Сумма: ${formatMoney(row.total_sum)}`);
        break;
      case "delivered_at":
        parts.push(`Доставлен: ${formatDtRu(row.delivered_at)}`);
        break;
      case "days_overdue":
        parts.push(`Дней после доставки: ${row.days_since_delivered}`);
        break;
      case "unpaid":
        parts.push(`Не оплачено: ${formatMoney(row.unpaid)}`);
        break;
      case "conditions":
        if (freeConditions?.trim()) parts.push(`Условия: ${freeConditions.trim()}`);
        break;
      default:
        break;
    }
  }
  return parts.join(" | ");
}

export async function convertConsignmentAutoCandidates(
  tenantId: number,
  input: {
    order_ids: number[];
    comment_fields: ConsignmentCommentFieldKey[];
    conditions_note?: string | null;
    consignment_due_date?: string | null;
    save_comment_fields?: boolean;
  },
  actorUserId: number | null
): Promise<{ updated: number[]; failed: { id: number; error: string }[] }> {
  const fields = normalizeCommentFields(input.comment_fields);
  if (input.save_comment_fields) {
    await patchConsignmentAutoSettings(tenantId, { comment_fields: fields });
  }

  const settings = await getConsignmentAutoSettings(tenantId);
  const want = [...new Set(input.order_ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (want.length === 0) return { updated: [], failed: [] };

  // Nomzodlarni to‘liq skan qilmasdan — tanlangan ID lar bo‘yicha tekshirish
  const all: ConsignmentAutoCandidate[] = [];
  let page = 1;
  for (;;) {
    const chunk = await listConsignmentAutoCandidates(tenantId, {
      page,
      page_size: 200,
      days_after_delivered: settings.days_after_delivered
    });
    all.push(...chunk.rows);
    if (all.length >= chunk.total || chunk.rows.length === 0 || page > 50) break;
    page += 1;
  }
  const byId = new Map(all.map((r) => [r.id, r]));

  const updated: number[] = [];
  const failed: { id: number; error: string }[] = [];

  for (const id of want) {
    const row = byId.get(id);
    if (!row) {
      failed.push({ id, error: "NOT_CANDIDATE" });
      continue;
    }
    const note = buildConsignmentAutoCommentParts(row, fields, input.conditions_note);
    const res = await bulkUpdateOrderConsignment(
      tenantId,
      [id],
      true,
      input.consignment_due_date ?? null,
      actorUserId,
      note || input.conditions_note || null
    );
    if (res.updated.includes(id)) updated.push(id);
    else {
      const f = res.failed.find((x) => x.id === id);
      failed.push(f ?? { id, error: "UNKNOWN" });
    }
  }

  return { updated, failed };
}
