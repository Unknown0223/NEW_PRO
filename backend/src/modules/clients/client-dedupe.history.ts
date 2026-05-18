import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export async function listClientMergeHistory(
  tenantId: number,
  page: number,
  limit: number
): Promise<{
  data: Array<{
    id: number;
    master_client_id: number;
    merged_client_id: number;
    merged_by_user_id: number | null;
    merged_at: string;
    payload: unknown;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const skip = (page - 1) * limit;
  const [rows, totalRow] = await Promise.all([
    prisma.clientMergeLog.findMany({
      where: { tenant_id: tenantId },
      orderBy: { merged_at: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        master_client_id: true,
        merged_client_id: true,
        merged_by_user_id: true,
        merged_at: true,
        payload: true
      }
    }),
    prisma.clientMergeLog.count({ where: { tenant_id: tenantId } })
  ]);
  return {
    data: rows.map((r) => ({
      id: r.id,
      master_client_id: r.master_client_id,
      merged_client_id: r.merged_client_id,
      merged_by_user_id: r.merged_by_user_id,
      merged_at: r.merged_at.toISOString(),
      payload: r.payload
    })),
    total: totalRow,
    page,
    limit
  };
}

/** «Объединённые» jadvali: bir operatsiya = bir qator. */
export async function listMergeSessionsForTenant(
  tenantId: number,
  page: number,
  limit: number,
  search?: string
): Promise<{
  data: Array<{
    master_client_id: number;
    master_name: string;
    merged_by_user_id: number | null;
    merged_by_name: string | null;
    merged_at: string;
    merged_clients_count: number;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const p = Math.max(1, page);
  const l = Math.min(100, Math.max(1, limit));
  const skip = (p - 1) * l;
  const term = search?.trim();
  const countSearch =
    term && term.length > 0 ? Prisma.sql`AND mc.name ILIKE ${`%${term}%`}` : Prisma.sql``;
  const outerWhere =
    term && term.length > 0 ? Prisma.sql`mc.name ILIKE ${`%${term}%`}` : Prisma.sql`TRUE`;

  const [countRow] = await prisma.$queryRaw<Array<{ c: bigint }>>(
    Prisma.sql`
    SELECT count(*)::bigint AS c FROM (
      SELECT 1
      FROM client_merge_logs l
      JOIN clients mc ON mc.id = l.master_client_id AND mc.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${tenantId}
        ${countSearch}
      GROUP BY l.master_client_id, l.merged_by_user_id, date_trunc('second', l.merged_at)
    ) s
  `
  );
  const total = Number(countRow?.c ?? 0);

  const rows = await prisma.$queryRaw<
    Array<{
      master_client_id: number;
      master_name: string;
      merged_by_user_id: number | null;
      merged_by_name: string | null;
      merged_at: Date;
      merged_clients_count: bigint;
    }>
  >(Prisma.sql`
    SELECT s.master_client_id,
           mc.name AS master_name,
           s.merged_by_user_id,
           u.name AS merged_by_name,
           s.merged_at,
           s.merged_clients_count
    FROM (
      SELECT l.master_client_id,
             l.merged_by_user_id,
             max(l.merged_at) AS merged_at,
             count(*)::bigint AS merged_clients_count,
             date_trunc('second', l.merged_at) AS merged_at_sec
      FROM client_merge_logs l
      WHERE l.tenant_id = ${tenantId}
      GROUP BY l.master_client_id, l.merged_by_user_id, date_trunc('second', l.merged_at)
    ) s
    JOIN clients mc ON mc.id = s.master_client_id AND mc.tenant_id = ${tenantId}
    LEFT JOIN users u ON u.id = s.merged_by_user_id
    WHERE ${outerWhere}
    ORDER BY s.merged_at DESC
    LIMIT ${l} OFFSET ${skip}
  `);

  return {
    data: rows.map((r) => ({
      master_client_id: r.master_client_id,
      master_name: r.master_name,
      merged_by_user_id: r.merged_by_user_id,
      merged_by_name: r.merged_by_name,
      merged_at: r.merged_at.toISOString(),
      merged_clients_count: Number(r.merged_clients_count)
    })),
    total,
    page: p,
    limit: l
  };
}
