import { Prisma, type PrismaClient } from "@prisma/client";
import { previewPolkiAutoBonusReverse } from "./returns-bonus-reverse.preview";
import type { CreatePeriodReturnInput } from "./returns-enhanced.types";
import { R } from "./returns-enhanced.helpers";

export const BONUS_DEBT_MOVEMENT_NOTE = "Долг бонус";

export function bonusDebtNote(returnNumber?: string | null): string {
  const ref = returnNumber?.trim();
  return ref ? `${BONUS_DEBT_MOVEMENT_NOTE} · ${ref}` : BONUS_DEBT_MOVEMENT_NOTE;
}

/** Erkin polki: bonus mahsulot yetmasa — preview bo‘yicha «Долг бонус» summasi (mijoz qarzi). */
export async function resolvePolkiBonusDebtAmount(
  tenantId: number,
  input: Pick<
    CreatePeriodReturnInput,
    "client_id" | "price_type" | "lines" | "bonus_debt_amount" | "order_id" | "date_from" | "date_to"
  >
): Promise<Prisma.Decimal> {
  const clientHint = Number(input.bonus_debt_amount);
  const clientDebt =
    Number.isFinite(clientHint) && clientHint > 0 ? R(clientHint) : new Prisma.Decimal(0);

  const byProduct = new Map<number, number>();
  for (const l of input.lines) {
    const rq = l.return_qty ?? 0;
    if (!(rq > 0)) continue;
    byProduct.set(l.product_id, (byProduct.get(l.product_id) ?? 0) + rq);
  }
  const previewLines = Array.from(byProduct.entries()).map(([product_id, return_qty]) => ({
    product_id,
    return_qty
  }));

  if (previewLines.length === 0) {
    return clientDebt;
  }

  const preview = await previewPolkiAutoBonusReverse(tenantId, {
    client_id: input.client_id,
    order_id: input.order_id,
    date_from: input.date_from,
    date_to: input.date_to,
    price_type: input.price_type,
    lines: previewLines
  });
  const serverDebt = R(preview.totals.bonus_debt_amount);
  return serverDebt.gt(0) ? serverDebt : clientDebt;
}

/** Kamchilik bo‘yicha mijoz balansini kamaytirish (manfiy delta) + ledger (client_payments). */
export async function applyClientBonusDebt(
  tx: PrismaClient | Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  amount: number | string | Prisma.Decimal,
  uid: number | null,
  opts?: { returnNumber?: string | null; paidAt?: Date }
): Promise<void> {
  const debt = R(amount);
  if (!debt.gt(0)) return;

  const note = bonusDebtNote(opts?.returnNumber);
  const delta = debt.negated();
  const eventAt = opts?.paidAt ?? new Date();

  await tx.payment.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      order_id: null,
      amount: debt,
      payment_type: "balance",
      note,
      created_by_user_id: uid,
      workflow_status: "confirmed",
      paid_at: eventAt,
      received_at: eventAt,
      confirmed_at: eventAt,
      entry_kind: "client_expense"
    }
  });

  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    create: { tenant_id: tenantId, client_id: clientId, balance: delta },
    update: { balance: { increment: delta } }
  });
  await tx.clientBalanceMovement.create({
    data: {
      client_balance_id: bal.id,
      delta,
      note,
      user_id: uid
    }
  });
}
