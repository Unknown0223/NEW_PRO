import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { R } from "./returns-enhanced.helpers";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { autoMarkReturnedOrders } from "./returns-enhanced.auto-mark";
import { applyClientBonusDebt, resolvePolkiBonusDebtAmount } from "./returns-enhanced.bonus-debt";
import type { PeriodReturnBatchResult, PeriodReturnResult } from "./returns-enhanced.types";
import type { PreparePeriodReturnBatchResult } from "./returns-enhanced.create-batch.prepare";

export async function persistPeriodReturnBatch(
  prep: PreparePeriodReturnBatchResult
): Promise<PeriodReturnBatchResult> {
  const { tenantId, input, actorUserId, prepared, warehouseId, uid, pMap } = prep;

  const { rows: created, mirrorOrderIds } = await prisma.$transaction(async (tx) => {
    const rows: Awaited<ReturnType<typeof tx.salesReturn.create>>[] = [];
    const mirrorOrderIds: number[] = [];
    for (const p of prepared) {
      const ret = await tx.salesReturn.create({
        data: {
          tenant_id: tenantId,
          number: p.number,
          client_id: input.client_id,
          order_id: p.orderId,
          warehouse_id: warehouseId,
          status: "posted",
          refund_amount: p.recalc.refund_amount,
          return_type: "partial",
          date_from: null,
          date_to: null,
          note: input.note?.trim() || null,
          refusal_reason_ref:
            input.refusal_reason_ref != null && String(input.refusal_reason_ref).trim()
              ? String(input.refusal_reason_ref).trim().slice(0, 128)
              : null,
          created_by_user_id: uid,
          ...(p.retLines.length > 0
            ? {
                lines: {
                  create: p.retLines.map((rl) => ({
                    product_id: rl.product_id,
                    qty: new Prisma.Decimal(rl.qty),
                    paid_qty: new Prisma.Decimal(rl.paid_qty),
                    bonus_qty: new Prisma.Decimal(rl.bonus_qty)
                  }))
                }
              }
            : {})
        },
        include: {
          client: { select: { name: true } },
          order: { select: { number: true } },
          warehouse: { select: { name: true } }
        }
      });

      const mid = await createPolkiMirrorZayavka(tx, {
        tenantId,
        number: p.number,
        clientId: input.client_id,
        warehouseId,
        orderType: "return_by_order",
        retLines: p.retLines,
        refundAmount: p.recalc.refund_amount,
        note: input.note?.trim() || null,
        refusalReasonRef: input.refusal_reason_ref ?? null,
        sourceOrderNumber: p.sourceOrderNumber
      });
      mirrorOrderIds.push(mid);

      for (const rl of p.retLines) {
        if (!(rl.qty > 0)) continue;
        const delta = new Prisma.Decimal(rl.qty);
        await tx.stock.upsert({
          where: {
            tenant_id_warehouse_id_product_id: {
              tenant_id: tenantId,
              warehouse_id: warehouseId,
              product_id: rl.product_id
            }
          },
          create: {
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            product_id: rl.product_id,
            qty: delta
          },
          update: { qty: { increment: delta } }
        });
      }

      if (p.recalc.refund_amount.gt(0)) {
        const bal = await tx.clientBalance.upsert({
          where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
          create: {
            tenant_id: tenantId,
            client_id: input.client_id,
            balance: p.recalc.refund_amount
          },
          update: { balance: { increment: p.recalc.refund_amount } }
        });
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: p.recalc.refund_amount,
            note: `Vazvrat: ${p.number}`,
            user_id: uid
          }
        });
      }

      rows.push(ret);
    }

    const batchDebt = await resolvePolkiBonusDebtAmount(tenantId, {
      client_id: input.client_id,
      price_type: input.price_type,
      lines: input.lines,
      bonus_debt_amount: input.bonus_debt_amount
    });
    if (batchDebt.gt(0)) {
      const refNum = rows[0]?.number ?? null;
      await applyClientBonusDebt(tx, tenantId, input.client_id, batchDebt, uid, {
        returnNumber: refNum
      });
    }

    return { rows, mirrorOrderIds };
  });

  for (const mid of mirrorOrderIds) {
    emitOrderUpdated(tenantId, mid);
  }
  void invalidateDashboard(tenantId);
  void invalidateStock(tenantId, warehouseId);

  await autoMarkReturnedOrders(tenantId, input.client_id, undefined, undefined, uid);

  const returns: PeriodReturnResult[] = [];
  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]!;
    const result = created[i]!;
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.stock,
      entityId: String(input.client_id),
      action: "period_return",
      payload: {
        return_id: result.id,
        number: result.number,
        order_id: p.orderId,
        bonus_recalc: {
          original_bonus_qty: p.recalc.original_bonus_qty,
          remaining_bonus_qty: p.recalc.remaining_bonus_qty,
          excess_bonus: p.recalc.excess_bonus,
          total_return_qty: p.recalc.total_return_qty,
          paid_return_qty: p.recalc.paid_return_qty,
          bonus_return_qty: p.recalc.bonus_return_qty,
          refund_amount: p.recalc.refund_amount.toString()
        },
        batch: true
      }
    });

    returns.push({
      id: result.id,
      number: result.number,
      refund_amount: result.refund_amount?.toString() ?? null,
      lines: p.retLines.map((rl) => ({
        product_id: rl.product_id,
        sku: pMap.get(rl.product_id)?.sku ?? "",
        name: pMap.get(rl.product_id)?.name ?? "",
        qty: String(rl.qty),
        paid_qty: String(rl.paid_qty),
        bonus_qty: String(rl.bonus_qty),
        paid_amount: R(rl.price).mul(rl.paid_qty).toString()
      })),
      bonus_recalc: { ...p.recalc, refund_amount: p.recalc.refund_amount.toString() }
    });
  }

  return { returns };
}
