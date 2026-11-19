/**
 * ClientBalanceMutator — mijoz balansi yozuv yadrosi (ADR-005).
 * Faqat `applyDelta`; sign / pending / expense tashqarida.
 */
import { Prisma } from "@prisma/client";
import type { DbExecutor } from "../../lib/db-context";

export type ApplyDeltaArgs = {
  tenantId: number;
  clientId: number;
  delta: Prisma.Decimal;
  note?: string | null;
  userId?: number | null;
};

export type ApplyDeltaResult = {
  id: number;
  balance: Prisma.Decimal;
};

type LockedBalanceRow = {
  id: number;
  balance: Prisma.Decimal;
};

/**
 * Mavjud `tx` ichida: qatorni FOR UPDATE qulflash (yo‘q bo‘lsa balance=0 yaratish),
 * `delta` qo‘llash, movement yozish. `delta === 0` → BAD_DELTA.
 */
export async function applyDelta(
  tx: DbExecutor,
  args: ApplyDeltaArgs
): Promise<ApplyDeltaResult> {
  const delta = args.delta;
  if (delta.isZero()) {
    throw new Error("BAD_DELTA");
  }

  // Race-safe create-if-missing (stock lock bilan bir xil shakl), keyin FOR UPDATE.
  await tx.$executeRaw`
    INSERT INTO client_balances (tenant_id, client_id, balance, updated_at)
    VALUES (${args.tenantId}, ${args.clientId}, 0, now())
    ON CONFLICT (tenant_id, client_id) DO NOTHING
  `;

  const locked = await tx.$queryRaw<LockedBalanceRow[]>`
    SELECT id, balance
    FROM client_balances
    WHERE tenant_id = ${args.tenantId}
      AND client_id = ${args.clientId}
    FOR UPDATE
  `;

  const row = locked[0];
  if (!row) {
    throw new Error("CLIENT_BALANCE_LOCK_FAILED");
  }

  const updated = await tx.clientBalance.update({
    where: {
      tenant_id_client_id: {
        tenant_id: args.tenantId,
        client_id: args.clientId
      }
    },
    data: { balance: { increment: delta } }
  });

  const uid =
    args.userId != null && Number.isFinite(args.userId) && args.userId > 0 ? args.userId : null;

  await tx.clientBalanceMovement.create({
    data: {
      client_balance_id: updated.id,
      delta,
      note: args.note?.trim() || null,
      user_id: uid
    }
  });

  return { id: updated.id, balance: updated.balance };
}
