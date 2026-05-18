import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import type { Visits2Filters, Visits2Row } from "./visits-2.types";
import { EXPORT_CAP } from "./visits-2.constants";
import {
  buildActorClientScopeSql,
  buildClientFilterSql,
  formatVisitWeekdaysJson,
  orderByRaw,
  parseDate,
  parseDateEndInclusiveUtc
} from "./visits-2.helpers";

export async function runVisits2Core(
  tenantId: number,
  f: Visits2Filters,
  actor: ReportActor | undefined,
  opts: { offset: number; limit: number }
): Promise<{ rows: Visits2Row[]; total: number }> {
  const fromD = parseDate(f.from);
  const toEnd = parseDateEndInclusiveUtc(f.to);
  if (!fromD || !toEnd) {
    return { rows: [], total: 0 };
  }

  const whereClients = buildClientFilterSql(tenantId, f, actor);
  const orderBy = orderByRaw(f);

  const countRows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM clients c
    WHERE ${whereClients}
  `;
  const total = Number(countRows[0]?.c ?? 0);

  const dataRows = await prisma.$queryRaw<
    Array<{
      client_id: number;
      client_name: string;
      client_phone: string | null;
      agent_name: string | null;
      visit_weekdays_json: unknown;
      last_visit_at: Date | null;
      t1: string | null;
      t2: string | null;
      t3: string | null;
    }>
  >`
    WITH visit_max AS (
      SELECT av.client_id, MAX(av.checked_in_at) AS last_visit_at
      FROM agent_visits av
      WHERE av.tenant_id = ${tenantId}
        AND av.client_id IS NOT NULL
        AND av.checked_in_at >= ${fromD}
        AND av.checked_in_at <= ${toEnd}
      GROUP BY av.client_id
    )
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      c.phone AS client_phone,
      COALESCE(u_slot.name, u_primary.name, '') AS agent_name,
      caa1.visit_weekdays AS visit_weekdays_json,
      vm.last_visit_at,
      c.zone AS t1,
      c.region AS t2,
      c.city AS t3
    FROM clients c
    LEFT JOIN client_agent_assignments caa1
      ON caa1.client_id = c.id AND caa1.tenant_id = c.tenant_id AND caa1.slot = 1
    LEFT JOIN users u_slot ON u_slot.id = caa1.agent_id AND u_slot.tenant_id = c.tenant_id
    LEFT JOIN users u_primary ON u_primary.id = c.agent_id AND u_primary.tenant_id = c.tenant_id
    LEFT JOIN visit_max vm ON vm.client_id = c.id
    WHERE ${whereClients}
    ORDER BY ${orderBy}
    OFFSET ${opts.offset} LIMIT ${opts.limit}
  `;

  const baseRow = (opts.offset ?? 0) + 1;
  const rows: Visits2Row[] = dataRows.map((r, i) => {
    const parts = [r.t1?.trim(), r.t2?.trim(), r.t3?.trim()].filter(Boolean);
    return {
      row_number: baseRow + i,
      client_id: r.client_id,
      client_name: r.client_name,
      client_phone: r.client_phone,
      agent_name: r.agent_name ?? "",
      visit_day_label: formatVisitWeekdaysJson(r.visit_weekdays_json),
      last_visit_at: r.last_visit_at ? r.last_visit_at.toISOString() : null,
      territory: parts.join(" / ")
    };
  });

  return { rows, total };
}

