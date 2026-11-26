import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { VisitsDetailFilters, VisitsDetailRow } from "./visits-report.types";

export const VISITS_DETAIL_CAP = 2000;

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

function clientFilterSql(f: VisitsDetailFilters, alias = "c"): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`${Prisma.raw(alias)}.merged_into_client_id IS NULL`];
  if (f.client_categories.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    parts.push(Prisma.sql`COALESCE(${Prisma.raw(alias)}.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  return Prisma.join(parts, " AND ");
}

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

type RawDetail = {
  client_id: number;
  client_name: string;
  visited_at: Date | null;
  order_sum: Prisma.Decimal | null;
  refusal_label: string | null;
  photo_count: bigint | null;
  inventory_label: string | null;
  last_purchase_sum: Prisma.Decimal | null;
  last_purchase_at: Date | null;
  total_count: bigint;
};

function baseClientsCte(tenantId: number, f: VisitsDetailFilters, from: Date | null, to: Date | null): Prisma.Sql {
  const clientSql = clientFilterSql(f);
  const agentId = f.agent_id;
  const dateVisitFrom = from ? Prisma.sql`AND av.checked_in_at >= ${from}` : Prisma.empty;
  const dateVisitTo = to ? Prisma.sql`AND av.checked_in_at <= ${to}` : Prisma.empty;
  const dateOrderFrom = from ? Prisma.sql`AND o.created_at >= ${from}` : Prisma.empty;
  const dateOrderTo = to ? Prisma.sql`AND o.created_at <= ${to}` : Prisma.empty;
  const dateRefusalFrom = from ? Prisma.sql`AND cr.created_at >= ${from}` : Prisma.empty;
  const dateRefusalTo = to ? Prisma.sql`AND cr.created_at <= ${to}` : Prisma.empty;
  const datePhotoFrom = from ? Prisma.sql`AND pr.created_at >= ${from}` : Prisma.empty;
  const datePhotoTo = to ? Prisma.sql`AND pr.created_at <= ${to}` : Prisma.empty;
  const planDateSql =
    from && to
      ? Prisma.sql`(caa.visit_date IS NOT NULL AND caa.visit_date >= ${from} AND caa.visit_date <= ${to})`
      : Prisma.sql`(caa.visit_date IS NOT NULL)`;

  const planned = Prisma.sql`
    SELECT DISTINCT caa.client_id
    FROM client_agent_assignments caa
    JOIN clients c ON c.id = caa.client_id AND c.tenant_id = caa.tenant_id
    WHERE caa.tenant_id = ${tenantId}
      AND caa.agent_id = ${agentId}
      AND ${clientSql}
      AND (
        (caa.visit_date IS NULL AND jsonb_array_length(COALESCE(caa.visit_weekdays::jsonb, '[]'::jsonb)) > 0)
        OR ${planDateSql}
      )
  `;

  const wantPlanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("planned");
  const wantUnplanned = f.visit_kinds.length === 0 || f.visit_kinds.includes("unplanned");

  const visitedRaw = Prisma.sql`
    SELECT DISTINCT av.client_id
    FROM agent_visits av
    JOIN clients c ON c.id = av.client_id AND c.tenant_id = av.tenant_id
    WHERE av.tenant_id = ${tenantId}
      AND av.agent_id = ${agentId}
      AND av.client_id IS NOT NULL
      ${dateVisitFrom}
      ${dateVisitTo}
      AND ${clientSql}
  `;

  const visitedKindSql = (() => {
    if (wantPlanned && wantUnplanned) return visitedRaw;
    if (wantPlanned && !wantUnplanned) {
      return Prisma.sql`
        SELECT v.client_id FROM (${visitedRaw}) v
        WHERE EXISTS (SELECT 1 FROM (${planned}) p WHERE p.client_id = v.client_id)
      `;
    }
    if (!wantPlanned && wantUnplanned) {
      return Prisma.sql`
        SELECT v.client_id FROM (${visitedRaw}) v
        WHERE NOT EXISTS (SELECT 1 FROM (${planned}) p WHERE p.client_id = v.client_id)
      `;
    }
    return Prisma.sql`SELECT NULL::int AS client_id WHERE FALSE`;
  })();

  switch (f.type) {
    case "okb":
      return Prisma.sql`
        SELECT DISTINCT caa.client_id
        FROM client_agent_assignments caa
        JOIN clients c ON c.id = caa.client_id AND c.tenant_id = caa.tenant_id
        WHERE caa.tenant_id = ${tenantId}
          AND caa.agent_id = ${agentId}
          AND ${clientSql}
      `;
    case "only_order":
      return Prisma.sql`
        SELECT DISTINCT o.client_id
        FROM orders o
        JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id = ${agentId}
          AND o.order_type = 'order'
          AND o.status <> 'cancelled'
          ${dateOrderFrom}
          ${dateOrderTo}
          AND ${clientSql}
      `;
    case "rejected":
      return Prisma.sql`
        SELECT DISTINCT cr.client_id
        FROM client_refusals cr
        JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
        WHERE cr.tenant_id = ${tenantId}
          AND cr.agent_id = ${agentId}
          ${dateRefusalFrom}
          ${dateRefusalTo}
          AND ${clientSql}
      `;
    case "only_photo":
      return Prisma.sql`
        SELECT DISTINCT pr.client_id
        FROM client_photo_reports pr
        JOIN clients c ON c.id = pr.client_id AND c.tenant_id = pr.tenant_id
        WHERE pr.tenant_id = ${tenantId}
          AND pr.created_by_user_id = ${agentId}
          AND pr.deleted_at IS NULL
          ${datePhotoFrom}
          ${datePhotoTo}
          AND ${clientSql}
      `;
    case "visited":
      return visitedKindSql;
    case "not_visited":
      // Reja bo‘yicha: planned − visited_planned (unplanned-only filterda ham planned qoladi — report bilan mos).
      return Prisma.sql`
        SELECT p.client_id FROM (${planned}) p
        WHERE NOT EXISTS (
          SELECT 1 FROM (${visitedRaw}) v WHERE v.client_id = p.client_id
        )
      `;
    default:
      return Prisma.sql`SELECT NULL::int AS client_id WHERE FALSE`;
  }
}

export async function getVisitsReportDetail(
  tenantId: number,
  f: VisitsDetailFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  if (scopedActor) {
    const allowed = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 AS ok
      FROM users u
      WHERE u.tenant_id = ${tenantId}
        AND u.id = ${f.agent_id}
        AND ${buildScopedAgentExistsSql(tenantId, Prisma.sql`u.id`, scopedActor)}
      LIMIT 1
    `;
    if (allowed.length === 0) {
      return { rows: [] as VisitsDetailRow[], total: 0, truncated: false, limit: VISITS_DETAIL_CAP };
    }
  }

  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const orderStatusSql = f.statuses.length
    ? Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`
    : Prisma.sql`o.status <> 'cancelled'`;
  const dateOrderFrom = from ? Prisma.sql`AND o.created_at >= ${from}` : Prisma.empty;
  const dateOrderTo = to ? Prisma.sql`AND o.created_at <= ${to}` : Prisma.empty;
  const dateVisitFrom = from ? Prisma.sql`AND av.checked_in_at >= ${from}` : Prisma.empty;
  const dateVisitTo = to ? Prisma.sql`AND av.checked_in_at <= ${to}` : Prisma.empty;
  const dateRefusalFrom = from ? Prisma.sql`AND cr.created_at >= ${from}` : Prisma.empty;
  const dateRefusalTo = to ? Prisma.sql`AND cr.created_at <= ${to}` : Prisma.empty;
  const datePhotoFrom = from ? Prisma.sql`AND pr.created_at >= ${from}` : Prisma.empty;
  const datePhotoTo = to ? Prisma.sql`AND pr.created_at <= ${to}` : Prisma.empty;

  const base = baseClientsCte(tenantId, f, from, to);

  const raw = await prisma.$queryRaw<RawDetail[]>`
    WITH base AS (
      ${base}
    ),
    counted AS (
      SELECT COUNT(*)::bigint AS total_count FROM base
    )
    SELECT
      c.id AS client_id,
      COALESCE(NULLIF(c.name, ''), '—') AS client_name,
      (
        SELECT MAX(av.checked_in_at)
        FROM agent_visits av
        WHERE av.tenant_id = ${tenantId}
          AND av.agent_id = ${f.agent_id}
          AND av.client_id = c.id
          ${dateVisitFrom}
          ${dateVisitTo}
      ) AS visited_at,
      (
        SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2)
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id = ${f.agent_id}
          AND o.client_id = c.id
          AND o.order_type = 'order'
          AND ${orderStatusSql}
          ${dateOrderFrom}
          ${dateOrderTo}
      ) AS order_sum,
      (
        SELECT COALESCE(MAX(cr.refusal_reason_ref), '')
        FROM client_refusals cr
        WHERE cr.tenant_id = ${tenantId}
          AND cr.agent_id = ${f.agent_id}
          AND cr.client_id = c.id
          ${dateRefusalFrom}
          ${dateRefusalTo}
      ) AS refusal_label,
      (
        SELECT COUNT(*)::bigint
        FROM client_photo_reports pr
        WHERE pr.tenant_id = ${tenantId}
          AND pr.client_id = c.id
          AND pr.created_by_user_id = ${f.agent_id}
          AND pr.deleted_at IS NULL
          ${datePhotoFrom}
          ${datePhotoTo}
      ) AS photo_count,
      (
        SELECT COALESCE(string_agg(DISTINCT ce.inventory_type, ', '), '')
        FROM client_equipment ce
        WHERE ce.tenant_id = ${tenantId}
          AND ce.client_id = c.id
          AND ce.removed_at IS NULL
      ) AS inventory_label,
      (
        SELECT o.total_sum::numeric(15,2)
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.client_id = c.id
          AND o.order_type = 'order'
          AND o.status <> 'cancelled'
        ORDER BY o.created_at DESC
        LIMIT 1
      ) AS last_purchase_sum,
      (
        SELECT o.created_at
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.client_id = c.id
          AND o.order_type = 'order'
          AND o.status <> 'cancelled'
        ORDER BY o.created_at DESC
        LIMIT 1
      ) AS last_purchase_at,
      (SELECT total_count FROM counted) AS total_count
    FROM base b
    JOIN clients c ON c.id = b.client_id AND c.tenant_id = ${tenantId}
    ORDER BY c.name ASC, c.id ASC
    LIMIT ${VISITS_DETAIL_CAP}
  `;

  const total = raw.length > 0 ? Number(raw[0].total_count) : 0;
  const rows: VisitsDetailRow[] = raw.map((r) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    visited_at: r.visited_at ? r.visited_at.toISOString() : null,
    order_sum: decStr(r.order_sum),
    refusal_label: (r.refusal_label ?? "").trim(),
    photo_count: Number(r.photo_count ?? 0),
    inventory_label: (r.inventory_label ?? "").trim(),
    last_purchase_sum: decStr(r.last_purchase_sum),
    last_purchase_at: r.last_purchase_at ? r.last_purchase_at.toISOString() : null
  }));

  return {
    rows,
    total,
    truncated: total > VISITS_DETAIL_CAP,
    limit: VISITS_DETAIL_CAP
  };
}
