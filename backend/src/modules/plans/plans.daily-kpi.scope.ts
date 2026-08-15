import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { DailyKpiOverviewQuery } from "./plans.daily-kpi.schema";

export type DailyKpiAgentScope = {
  supervisor_ids: number[];
  agent_ids: number[];
  branch_codes: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
};

export function parseDailyKpiAgentScope(query: DailyKpiOverviewQuery): DailyKpiAgentScope {
  const branch_codes = [
    ...new Set([...(query.branches ?? []), ...(query.branch_codes ?? [])])
  ];
  return {
    supervisor_ids: query.supervisor_ids ?? [],
    agent_ids: query.agent_ids ?? [],
    branch_codes,
    territory_1_list: [
      ...new Set([...(query.territory_1 ?? []), ...(query.territory1 ?? [])])
    ],
    territory_2_list: [
      ...new Set([...(query.territory_2 ?? []), ...(query.territory2 ?? [])])
    ],
    territory_3_list: [
      ...new Set([...(query.territory_3 ?? []), ...(query.territory3 ?? [])])
    ]
  };
}

/**
 * Hudud filteri: klient zone/region/city YOKI agent `users.territory`
 * (`zona / oblast / shahar` — work-slots format).
 */
export async function resolveAgentIdsByClientTerritory(
  tenantId: number,
  scope: Pick<DailyKpiAgentScope, "territory_1_list" | "territory_2_list" | "territory_3_list">
): Promise<number[] | null> {
  const hasT =
    scope.territory_1_list.length > 0 ||
    scope.territory_2_list.length > 0 ||
    scope.territory_3_list.length > 0;
  if (!hasT) return null;

  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (scope.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(scope.territory_1_list)})`
    );
  }
  if (scope.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(scope.territory_2_list)})`
    );
  }
  if (scope.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(scope.territory_3_list)})`
    );
  }

  const userTerrParts: Prisma.Sql[] = [
    Prisma.sql`u.tenant_id = ${tenantId}`,
    Prisma.sql`u.role = 'agent'`,
    Prisma.sql`u.is_active = true`,
    Prisma.sql`u.territory IS NOT NULL`,
    Prisma.sql`btrim(u.territory) <> ''`
  ];
  // users.territory = "zona / oblast / city" (split by / , ; |)
  if (scope.territory_1_list.length > 0) {
    userTerrParts.push(Prisma.sql`
      btrim(split_part(regexp_replace(btrim(u.territory), '[,;|]+', ' / ', 'g'), '/', 1))
        IN (${Prisma.join(scope.territory_1_list)})
    `);
  }
  if (scope.territory_2_list.length > 0) {
    userTerrParts.push(Prisma.sql`
      NULLIF(btrim(split_part(regexp_replace(btrim(u.territory), '[,;|]+', ' / ', 'g'), '/', 2)), '')
        IN (${Prisma.join(scope.territory_2_list)})
    `);
  }
  if (scope.territory_3_list.length > 0) {
    userTerrParts.push(Prisma.sql`
      NULLIF(btrim(split_part(regexp_replace(btrim(u.territory), '[,;|]+', ' / ', 'g'), '/', 3)), '')
        IN (${Prisma.join(scope.territory_3_list)})
    `);
  }

  const rows = await prisma.$queryRaw<Array<{ agent_id: number }>>`
    SELECT DISTINCT agent_id FROM (
      SELECT c.agent_id AS agent_id
      FROM clients c
      WHERE ${Prisma.join(parts, " AND ")}
        AND c.agent_id IS NOT NULL
      UNION
      SELECT caa.agent_id AS agent_id
      FROM clients c
      JOIN client_agent_assignments caa ON caa.client_id = c.id
      WHERE ${Prisma.join(parts, " AND ")}
      UNION
      SELECT u.id AS agent_id
      FROM users u
      WHERE ${Prisma.join(userTerrParts, " AND ")}
    ) t
    WHERE agent_id IS NOT NULL
  `;
  return rows.map((r) => r.agent_id);
}

/** Bo‘sh filial filtri qiymati (setup «Без филиала»). */
export const DAILY_KPI_EMPTY_BRANCH = "__empty_branch__";
export const DAILY_KPI_EMPTY_BRANCH_LABEL = "Без филиала";

export function withEmptyBranchOption(branchOptions: string[], hasEmpty: boolean): string[] {
  if (!hasEmpty) return branchOptions;
  return [
    DAILY_KPI_EMPTY_BRANCH_LABEL,
    ...branchOptions.filter((b) => b && b !== DAILY_KPI_EMPTY_BRANCH_LABEL)
  ];
}

export function isEmptyBranchFilterValue(b: string): boolean {
  return b === DAILY_KPI_EMPTY_BRANCH || b === DAILY_KPI_EMPTY_BRANCH_LABEL;
}
/** Prisma `user` where fragment — plan target query uchun. */
export function buildDailyKpiUserWhere(
  tenantId: number,
  scope: DailyKpiAgentScope,
  search: string | undefined,
  territoryAgentIds: number[] | null
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [
    { tenant_id: tenantId, role: "agent", is_active: true }
  ];

  if (scope.supervisor_ids.length > 0) {
    and.push({ supervisor_user_id: { in: scope.supervisor_ids } });
  }
  if (scope.branch_codes.length > 0) {
    const wantEmpty = scope.branch_codes.some(isEmptyBranchFilterValue);
    const named = scope.branch_codes.filter((b) => b && !isEmptyBranchFilterValue(b));
    if (wantEmpty && named.length > 0) {
      and.push({
        OR: [{ branch: { in: named } }, { branch: null }, { branch: "" }]
      });
    } else if (wantEmpty) {
      and.push({ OR: [{ branch: null }, { branch: "" }] });
    } else {
      and.push({ branch: { in: named } });
    }
  }

  let ids: number[] | null = scope.agent_ids.length > 0 ? [...scope.agent_ids] : null;
  if (territoryAgentIds != null) {
    if (ids == null) ids = territoryAgentIds;
    else {
      const set = new Set(territoryAgentIds);
      ids = ids.filter((id) => set.has(id));
    }
  }
  if (ids != null) {
    and.push({ id: { in: ids.length > 0 ? ids : [-1] } });
  }

  if (search?.trim()) {
    const q = search.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } }
      ]
    });
  }

  return { AND: and };
}
