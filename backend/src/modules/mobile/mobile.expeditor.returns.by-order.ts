/**
 * Mobil ekspeditor — «Возврат с полки по заказу» create + preview (skidka qarzi).
 */
import { createPeriodReturn } from "../returns/returns-enhanced.create-period";
import { previewPolkiAutoBonusReverse } from "../returns/returns-bonus-reverse.preview";
import {
  resolveOrderDiscountClawback,
  sumPaidNetFromItems
} from "../returns/returns-enhanced.discount-debt";
import { R } from "../returns/returns-enhanced.helpers";
import { getClientReturnsData } from "../returns/returns-enhanced.client-data";
import {
  assertExpeditorOwnsOrder,
  loadExpeditorMobileConfig
} from "./mobile.expeditor.orders.service";
import {
  mergeReturnByOrderQtyMaps,
  parseReturnByOrderLineRequests,
  type ReturnByOrderLineInput
} from "./mobile.expeditor.peresort";

/**
 * «Возврат с полки по заказу» yaratish — web bilan bir xil logika
 * (`createPeriodReturn`, order-scoped): SalesReturn + mirror order, savdo/bonus
 * hisobi, balansga refund, filter/qty validatsiyalari.
 */
export async function createMobileExpeditorReturnByOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: {
    lines: ReturnByOrderLineInput[];
    note?: string | null;
    reason?: string | null;
  }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const { autoReq, manualReq, targetByProduct } = parseReturnByOrderLineRequests(input.lines);
  if (autoReq.size === 0 && manualReq.size === 0) throw new Error("EMPTY_LINES");

  let previewLines: Awaited<ReturnType<typeof previewPolkiAutoBonusReverse>>["lines"] = [];
  if (autoReq.size > 0) {
    const preview = await previewPolkiAutoBonusReverse(tenantId, {
      client_id: order.client_id,
      order_id: orderId,
      lines: Array.from(autoReq.entries()).map(([product_id, v]) => ({
        product_id,
        return_qty: v.return_qty
      }))
    });
    previewLines = preview.lines;
  }

  const { merged, totalDebt } = mergeReturnByOrderQtyMaps(manualReq, previewLines);

  const lines = Array.from(merged.entries())
    .filter(([, v]) => v.paid + v.bonus > 0)
    .map(([product_id, v]) => {
      const tgt = targetByProduct.get(product_id);
      return {
        product_id,
        paid_qty: v.paid,
        bonus_qty: v.bonus,
        ...(tgt != null ? { return_as_product_id: tgt } : {})
      };
    });
  if (lines.length === 0) throw new Error("EMPTY_LINES");

  return createPeriodReturn(
    tenantId,
    {
      client_id: order.client_id,
      order_id: orderId,
      lines,
      note: input.note ?? null,
      refusal_reason_ref: input.reason ?? null,
      bonus_debt_amount: totalDebt > 0 ? totalDebt : undefined,
      skip_order_scoped_reconcile: true
    },
    expeditorUserId
  );
}

/** «Возврат с полки по заказу» oldindan hisoblash (bonus + skidka qarzi). */
export async function previewMobileExpeditorReturnByOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  lines: Array<{ product_id: number; return_qty: number }>
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const emptyDiscount = {
    discount_debt_amount: "0",
    discount_debt_note: null as string | null,
    discount_debt_mode: "none" as const,
    discount_sum_after: null as string | null
  };

  const effective = lines.filter((l) => l.return_qty > 0);
  if (effective.length === 0) {
    return {
      lines: [],
      totals: {
        paid_qty: 0,
        bonus_qty: 0,
        bonus_debt_qty: 0,
        bonus_debt_amount: "0",
        refund_amount: "0",
        ...emptyDiscount
      },
      warnings: [] as string[]
    };
  }

  const preview = await previewPolkiAutoBonusReverse(tenantId, {
    client_id: order.client_id,
    order_id: orderId,
    lines: effective
  });

  const cdata = await getClientReturnsData(
    tenantId,
    order.client_id,
    undefined,
    undefined,
    orderId,
    undefined,
    { shrinkLineQtyAfterReturns: true }
  );
  const remainingPaidNetBefore = sumPaidNetFromItems(cdata.items);
  const thisReturnPaidNet = R(preview.totals.refund_amount);
  const claw = await resolveOrderDiscountClawback(
    tenantId,
    orderId,
    thisReturnPaidNet,
    remainingPaidNetBefore
  );

  const discountDebtAmount =
    claw != null && claw.amount.gt(0) ? claw.amount.toString() : "0";
  const discountDebtNote =
    claw != null && claw.amount.gt(0) && claw.note.trim() ? claw.note.slice(0, 500) : null;
  const discountDebtMode = claw?.mode ?? "none";
  const discountSumAfter = claw != null ? claw.new_discount_sum.toString() : null;

  const warnings = [...preview.warnings];
  if (claw != null && claw.amount.gt(0)) {
    warnings.push(
      claw.mode === "full_revoke"
        ? `Долг скидка: ${discountDebtAmount} — условие скидки больше не выполняется (после приёмки на складе)`
        : `Долг скидка: ${discountDebtAmount} (после приёмки на складе)`
    );
  } else if (claw != null && claw.mode === "proportional") {
    warnings.push("Скидка по заказу будет пересчитана пропорционально возврату");
  }

  return {
    ...preview,
    totals: {
      ...preview.totals,
      discount_debt_amount: discountDebtAmount,
      discount_debt_note: discountDebtNote,
      discount_debt_mode: discountDebtMode,
      discount_sum_after: discountSumAfter
    },
    warnings
  };
}
