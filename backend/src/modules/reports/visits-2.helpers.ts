import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { Visits2Filters } from "./visits-2.types";
import { WEEKDAY_LABEL_RU } from "./visits-2.constants";

export function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateEndInclusiveUtc(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(`${(v ?? "").trim().slice(0, 10)}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function strList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function intListUnique(v?: string): number[] {
  const xs = intList(v);
  return [...new Set(xs)].filter((n) => n >= 1 && n <= 7);
}

export function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

export function formatVisitWeekdaysJson(raw: unknown): string {
  if (raw == null) return "";
  let arr: number[] = [];
  if (Array.isArray(raw)) {
    arr = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  } else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) arr = p.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
    } catch {
      return "";
    }
  }
  const uniq = [...new Set(arr)].sort((a, b) => a - b);
  return uniq.map((d) => WEEKDAY_LABEL_RU[d] ?? String(d)).join(", ");
}

export function buildActorClientScopeSql(tenantId: number, actor?: ReportActor): Prisma.Sql {
  if (actor?.userId && actor.role === "agent") {
    return Prisma.sql`(
      c.agent_id = ${actor.userId}
      OR EXISTS (
        SELECT 1 FROM client_agent_assignments caa_scope
        WHERE caa_scope.client_id = c.id
          AND caa_scope.tenant_id = ${tenantId}
          AND caa_scope.agent_id = ${actor.userId}
      )
    )`;
  }
  if (actor?.userId && actor.role === "supervisor") {
    return Prisma.sql`(
      EXISTS (
        SELECT 1 FROM users su_p
        WHERE su_p.id = c.agent_id
          AND su_p.tenant_id = ${tenantId}
          AND su_p.supervisor_user_id = ${actor.userId}
      )
      OR EXISTS (
        SELECT 1 FROM client_agent_assignments caa_sc
        JOIN users su_a ON su_a.id = caa_sc.agent_id AND su_a.tenant_id = ${tenantId}
        WHERE caa_sc.client_id = c.id
          AND caa_sc.agent_id IS NOT NULL
          AND su_a.supervisor_user_id = ${actor.userId}
      )
    )`;
  }
  return Prisma.sql`TRUE`;
}

export function buildClientFilterSql(tenantId: number, f: Visits2Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`,
    buildActorClientScopeSql(tenantId, actor)
  ];

  if (f.agent_ids && f.agent_ids.length > 0) {
    parts.push(
      Prisma.sql`(
        c.agent_id IN (${Prisma.join(f.agent_ids)})
        OR EXISTS (
          SELECT 1 FROM client_agent_assignments caa_f
          WHERE caa_f.client_id = c.id
            AND caa_f.tenant_id = ${tenantId}
            AND caa_f.agent_id IN (${Prisma.join(f.agent_ids)})
        )
      )`
    );
  }

  if (f.client_categories && f.client_categories.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }

  if (f.product_category_refs && f.product_category_refs.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.product_category_ref, '') IN (${sqlInStrings(f.product_category_refs)})`);
  }

  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }

  if (f.weekdays && f.weekdays.length > 0) {
    const ors: Prisma.Sql[] = f.weekdays.map((wd) =>
      Prisma.sql`EXISTS (
        SELECT 1 FROM client_agent_assignments caa_w
        WHERE caa_w.client_id = c.id
          AND caa_w.tenant_id = ${tenantId}
          AND caa_w.visit_weekdays::jsonb @> ${JSON.stringify([wd])}::jsonb
      )`
    );
    parts.push(Prisma.sql`(${Prisma.join(ors, " OR ")})`);
  }

  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && String(idTry) === search.trim()) {
      parts.push(
        Prisma.sql`(
          c.id = ${idTry}
          OR c.name ILIKE ${pat}
          OR COALESCE(c.phone, '') ILIKE ${pat}
        )`
      );
    } else {
      parts.push(
        Prisma.sql`(
          c.name ILIKE ${pat}
          OR COALESCE(c.phone, '') ILIKE ${pat}
        )`
      );
    }
  }

  return Prisma.join(parts, " AND ");
}

export function orderByRaw(f: Visits2Filters): Prisma.Sql {
  const d = f.sort_dir === "desc" ? "DESC" : "ASC";
  switch (f.sort_by) {
    case "client_id":
      return Prisma.raw(`c.id ${d}`);
    case "last_visit":
      return Prisma.raw(
        f.sort_dir === "desc"
          ? `vm.last_visit_at DESC NULLS LAST`
          : `vm.last_visit_at ASC NULLS FIRST`
      );
    case "agent_name":
      return Prisma.raw(`COALESCE(u_slot.name, u_primary.name, '') ${d}`);
    case "territory":
      return Prisma.raw(`COALESCE(c.zone, ''), COALESCE(c.region, ''), COALESCE(c.city, '') ${d}`);
    case "client_name":
    default:
      return Prisma.raw(`c.name ${d}`);
  }
}

