import { Prisma } from "@prisma/client";

export type BalanceUpsertResult = {
  id: number;
  balance: Prisma.Decimal;
};

export async function upsertClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  initialBalance: Prisma.Decimal = new Prisma.Decimal(0)
): Promise<BalanceUpsertResult> {
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id: clientId } },
    create: {
      tenant_id: tenantId,
      client_id: clientId,
      balance: initialBalance
    },
    update: {}
  });
  return { id: bal.id, balance: bal.balance };
}

export async function incrementClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  delta: Prisma.Decimal
): Promise<BalanceUpsertResult> {
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id: clientId } },
    create: { tenant_id, client_id, balance: delta },
    update: { balance: { increment: delta } }
  });
  return { id: bal.id, balance: bal.balance };
}

export async function decrementClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  delta: Prisma.Decimal
): Promise<BalanceUpsertResult> {
  const negDelta = new Prisma.Decimal(0).sub(delta);
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id: clientId } },
    create: { tenant_id, client_id, balance: negDelta },
    update: { balance: { increment: delta.neg() } }
  });
  return { id: bal.id, balance: bal.balance };
}

export async function createBalanceMovement(
  tx: Prisma.TransactionClient,
  balanceId: number,
  delta: Prisma.Decimal,
  note: string,
  userId?: number | null
): Promise<void> {
  await tx.clientBalanceMovement.create({
    data: {
      client_balance_id: balanceId,
      delta,
      note,
      user_id: userId ?? null
    }
  });
}