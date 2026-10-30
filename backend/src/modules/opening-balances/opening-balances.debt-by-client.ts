import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { LARGE_CLIENT_IDS_CHUNK } from "../client-balances/client-balances.constants";

/**
 * Mijoz bo‘yicha ochiq «начальный баланс» qarzi (musbat = qarzdorlik).
 * debt entry → +amount; surplus → −amount. O‘chirilganlar hisobga olinmaydi.
 */
export async function loadOpeningDebtByClient(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, Prisma.Decimal>> {
  const map = new Map<number, Prisma.Decimal>();
  if (clientIds.length === 0) return map;

  for (let i = 0; i < clientIds.length; i += LARGE_CLIENT_IDS_CHUNK) {
    const chunk = clientIds.slice(i, i + LARGE_CLIENT_IDS_CHUNK);
    const rows = await prisma.$queryRaw<
      Array<{ client_id: number; opening_debt: Prisma.Decimal }>
    >`
      SELECT e.client_id,
        COALESCE(SUM(
          CASE
            WHEN e.balance_type = 'debt' THEN e.amount
            WHEN e.balance_type = 'surplus' THEN -e.amount
            ELSE 0::decimal(15,2)
          END
        ), 0)::decimal(15,2) AS opening_debt
      FROM client_opening_balance_entries e
      WHERE e.tenant_id = ${tenantId}
        AND e.deleted_at IS NULL
        AND e.client_id IN (${Prisma.join(chunk)})
      GROUP BY e.client_id
    `;
    for (const r of rows) {
      map.set(r.client_id, r.opening_debt);
    }
  }
  return map;
}
