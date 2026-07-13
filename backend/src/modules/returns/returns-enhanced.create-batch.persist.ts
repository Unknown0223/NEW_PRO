import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { R } from "./returns-enhanced.helpers";
import { createPolkiMirrorZayavka } from "./returns-enhanced.polki";
import { resolvePolkiBonusDebtAmount } from "./returns-enhanced.bonus-debt";
import type { PeriodReturnBatchResult, PeriodReturnResult } from "./returns-enhanced.types";
import type { PreparePeriodReturnBatchResult } from "./returns-enhanced.create-batch.prepare";

export async function persistPeriodReturnBatch(
  prep: PreparePeriodReturnBatchResult
): Promise<PeriodReturnBatchResult> {
  const { tenantId, input, actorUserId, prepared, warehouseId, uid, pMap } = prep;

  // Bonus qarzi butun partiya bo'yicha yagona — uni birinchi vazvratga biriktiramiz,
  // qabulda shu vazvrat tasdiqlanganda qo'llanadi.
  const batchDebt = await resolvePolkiBonusDebtAmount(tenantId, {
    client_id: input.client_id,
    price_type: input.price_type,
    lines: input.lines,
    bonus_debt_amount: input.bonus_debt_amount
  });

  const { rows: created, mirrorOrderIds } = await prisma.$transaction(async (tx) => {
    const rows: Awaited<ReturnType<typeof tx.salesReturn.create>>[] = [];
    const mirrorOrderIds: number[] = [];
    let debtAttached = false;
    for (const p of prepared) {
      const attachDebt = !debtAttached && batchDebt.gt(0);
      if (attachDebt) debtAttached = true;
      const claw = p.discountClawback;
      const discDebt =
        claw != null && claw.amount.gt(0) ? claw : null;
      const ret = await tx.salesReturn.create({
        data: {
          tenant_id: tenantId,
          number: p.number,
          client_id: input.client_id,
          order_id: p.orderId,
          warehouse_id: warehouseId,
          status: "pending",
          refund_amount: p.recalc.refund_amount,
          bonus_debt_amount: attachDebt ? batchDebt : null,
          discount_debt_amount: discDebt != null ? discDebt.amount : null,
          discount_debt_note:
            discDebt != null && discDebt.note ? discDebt.note.slice(0, 500) : null,
          discount_sum_after: claw != null ? claw.new_discount_sum : null,
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
        sourceOrderNumber: p.sourceOrderNumber,
        actorUserId: uid,
        discountDebtAmount: discDebt != null ? discDebt.amount : null,
        discountDebtNote:
          discDebt != null && discDebt.note ? discDebt.note.slice(0, 500) : null,
        discountPct: claw?.discount_pct ?? null
      });
      mirrorOrderIds.push(mid);

      // Side-effect'lar (ostatka / balans / bonus / auto-mark) qabulda qo'llanadi.
      await tx.salesReturn.update({
        where: { id: ret.id },
        data: { mirror_order_id: mid }
      });

      rows.push(ret);
    }

    return { rows, mirrorOrderIds };
  });

  for (const mid of mirrorOrderIds) {
    emitOrderUpdated(tenantId, mid);
  }
  void invalidateDashboard(tenantId);

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
      discount_debt_amount:
        p.discountClawback != null && p.discountClawback.amount.gt(0)
          ? p.discountClawback.amount.toString()
          : null,
      discount_debt_note:
        p.discountClawback != null && p.discountClawback.amount.gt(0)
          ? p.discountClawback.note
          : null,
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
