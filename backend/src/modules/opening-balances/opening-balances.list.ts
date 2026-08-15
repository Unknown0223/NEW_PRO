import { prisma } from "../../config/database";
import type { OpeningBalanceListQuery, OpeningBalanceListRow } from "./opening-balances.types";
import type { ScopedReportActor } from "../access/access-agent-scope";
import { buildWhere, listInclude, mapRow } from "./opening-balances.shared";

/** UI may send name while legacy rows store code (or vice versa) — match both. */
async function resolveTradeDirectionAliases(tenantId: number, raw: string): Promise<string[]> {
  const td = raw.trim();
  if (!td) return [];
  const rows = await prisma.tradeDirection.findMany({
    where: {
      tenant_id: tenantId,
      OR: [
        { code: { equals: td, mode: "insensitive" } },
        { name: { equals: td, mode: "insensitive" } }
      ]
    },
    select: { code: true, name: true },
    take: 20
  });
  const out = new Set<string>([td]);
  for (const r of rows) {
    const code = r.code?.trim();
    const name = r.name?.trim();
    if (code) out.add(code);
    if (name) out.add(name);
  }
  return [...out];
}

export async function listOpeningBalances(
  tenantId: number,
  q: OpeningBalanceListQuery,
  actor?: ScopedReportActor
): Promise<{ data: OpeningBalanceListRow[]; total: number; page: number; limit: number }> {
  let query = q;
  if (q.trade_direction?.trim()) {
    const aliases = await resolveTradeDirectionAliases(tenantId, q.trade_direction);
    query = { ...q, trade_direction_aliases: aliases };
  }
  const where = buildWhere(tenantId, query, actor);
  const [total, rows] = await prisma.$transaction([
    prisma.clientOpeningBalanceEntry.count({ where }),
    prisma.clientOpeningBalanceEntry.findMany({
      where,
      include: listInclude,
      orderBy: { created_at: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit
    })
  ]);
  return {
    data: rows.map((r) => mapRow(r)),
    total,
    page: q.page,
    limit: q.limit
  };
}
