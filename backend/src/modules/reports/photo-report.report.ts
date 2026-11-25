import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { buildPhotoReportThumbUrl } from "./photo-report.content";
import type { PhotoReportFilters, PhotoReportRow } from "./photo-report.types";

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

function roleLabel(role: string | null | undefined): string {
  const r = String(role ?? "").trim();
  if (r === "agent") return "Агент";
  if (r === "expeditor") return "Экспедитор";
  if (r === "supervisor") return "Супервайзер";
  return r || "—";
}

function buildWhere(tenantId: number, f: PhotoReportFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`pr.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  if (from) parts.push(Prisma.sql`pr.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`pr.created_at <= ${to}`);
  if (f.archive === "active") parts.push(Prisma.sql`pr.deleted_at IS NULL`);
  if (f.archive === "void") parts.push(Prisma.sql`pr.deleted_at IS NOT NULL`);
  if (f.client_active === "active") parts.push(Prisma.sql`c.is_active = TRUE`);
  if (f.client_active === "inactive") parts.push(Prisma.sql`c.is_active = FALSE`);
  if (f.user_ids.length) {
    parts.push(Prisma.sql`pr.created_by_user_id IN (${Prisma.join(f.user_ids)})`);
  }
  if (f.user_roles.length) {
    parts.push(Prisma.sql`COALESCE(u.role, '') IN (${sqlInStrings(f.user_roles)})`);
  }
  if (f.client_categories.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  if (f.photo_categories.length) {
    parts.push(
      Prisma.sql`COALESCE(NULLIF(btrim(pr.caption), ''), 'Без категории') IN (${sqlInStrings(f.photo_categories)})`
    );
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(
        c.name ILIKE ${pat}
        OR COALESCE(c.phone, '') ILIKE ${pat}
        OR COALESCE(c.client_code, '') ILIKE ${pat}
        OR COALESCE(u.name, '') ILIKE ${pat}
        OR COALESCE(pr.caption, '') ILIKE ${pat}
      )`
    );
  }
  if (actor) {
    parts.push(
      buildScopedAgentExistsSql(
        tenantId,
        Prisma.sql`COALESCE(pr.created_by_user_id, c.agent_id)`,
        actor
      )
    );
  }
  return Prisma.join(parts, " AND ");
}

export async function getPhotoReport(
  tenantId: number,
  f: PhotoReportFilters,
  actor?: ReportActor,
  tenantSlug?: string
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;
  const slug = (tenantSlug ?? "").trim();

  type Raw = {
    photo_id: number;
    client_id: number;
    client_code: string | null;
    client_name: string;
    created_at: Date;
    client_category: string | null;
    territory: string | null;
    user_id: number | null;
    user_name: string | null;
    user_role: string | null;
    category: string | null;
    deleted_at: Date | null;
    content_purged_at: Date | null;
    total_count: bigint;
    agent_photo_count: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    SELECT
      pr.id AS photo_id,
      c.id AS client_id,
      COALESCE(c.client_code, '') AS client_code,
      c.name AS client_name,
      pr.created_at,
      COALESCE(c.category, '') AS client_category,
      COALESCE(NULLIF(c.city, ''), NULLIF(c.region, ''), NULLIF(c.zone, ''), '') AS territory,
      pr.created_by_user_id AS user_id,
      COALESCE(u.name, '') AS user_name,
      COALESCE(u.role, '') AS user_role,
      COALESCE(NULLIF(btrim(pr.caption), ''), 'Без категории') AS category,
      pr.deleted_at,
      pr.content_purged_at,
      COUNT(*) OVER()::bigint AS total_count,
      COUNT(*) OVER (PARTITION BY pr.created_by_user_id)::bigint AS agent_photo_count
    FROM client_photo_reports pr
    JOIN clients c ON c.id = pr.client_id
    LEFT JOIN users u ON u.id = pr.created_by_user_id
    WHERE ${whereSql}
    ORDER BY pr.created_at DESC, pr.id DESC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: PhotoReportRow[] = rows.map((r, idx) => {
    const content_purged = r.content_purged_at != null;
    const archived = r.deleted_at != null;
    return {
      row_number: offset + idx + 1,
      photo_id: r.photo_id,
      client_id: r.client_id,
      client_code: r.client_code ?? "",
      client_name: r.client_name,
      created_at: r.created_at.toISOString(),
      client_category: r.client_category ?? "",
      territory: r.territory ?? "",
      user_id: r.user_id != null ? Number(r.user_id) : null,
      user_name: r.user_name ?? "",
      user_role: roleLabel(r.user_role),
      category: r.category ?? "Без категории",
      status_label: archived ? "Архив" : "Активный",
      content_purged,
      thumb_url: slug
        ? buildPhotoReportThumbUrl(slug, r.photo_id, content_purged || archived)
        : null,
      agent_photo_count: Number(r.agent_photo_count ?? 0)
    };
  });

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    rows: mapped
  };
}
