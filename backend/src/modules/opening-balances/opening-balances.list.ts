import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { OpeningBalanceListQuery, OpeningBalanceListRow } from "./opening-balances.types";
import { buildWhere, listInclude, mapRow } from "./opening-balances.shared";

export async function listOpeningBalances(
  tenantId: number,
  q: OpeningBalanceListQuery
): Promise<{ data: OpeningBalanceListRow[]; total: number; page: number; limit: number }> {
  const where = buildWhere(tenantId, q);
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
