"use client";

import { api } from "@/lib/api";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import { POLKI_SKIDKA_OPTS } from "../constants";
import { parseDiscountDebtAmount } from "../bonus-debt/bonus-debt.logic";
import { isPolkiAutoBonusOverMax } from "../polki-policy/polki-return-policy.logic";
import { tradeDirectionLabel } from "../view/polki-shelf-return/polki-trade-direction-options";
import type { OrderCreateContextResponse } from "../draft/draft.types";
import type { PolkiPairRowModel } from "../types";

export type PolkiSubmitCtx = {
  tenantSlug: string;
  clientId: string;
  warehouseId: string;
  priceType: string;
  orderComment: string;
  orderNotePreset: string;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  polkiOrderIds: number[];
  polkiUsesAutoBonus: boolean;
  polkiAutoBonusPreviewPending: boolean;
  polkiAutoBonusPreviewError: boolean;
  polkiAutoBonusPreviewReady: boolean;
  polkiRowsAll: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  polkiAutoBonusExplicitByPairKey?: Record<string, { paid: number; bonus: number }>;
  polkiSubmitSlice: {
    usePeriodBatch: boolean;
    batchLines: unknown[];
    periodMerge: Map<number, { paid: number; bonus: number; cash: number }>;
    returnQtyByProduct: Map<number, number>;
    missingOrderId: boolean;
  };
  polkiHeaderDate: string;
  polkiTradeDirection: string;
  polkiSkidkaType: string;
  refusalReasonRefPolki: string;
  polkiDateFrom: string;
  polkiDateTo: string;
  polkiSubmitBonusDebt: number;
  ctxProfile: OrderCreateContextResponse["settings_profile"] | undefined;
};

export async function runPolkiSubmit(ctx: PolkiSubmitCtx): Promise<{
  bonusDebtApplied: number;
  discountDebtApplied: number;
  discountDebtNote: string | null;
}> {
  const cid = Number.parseInt(ctx.clientId, 10);
  if (!Number.isFinite(cid) || cid < 1) throw new Error("client");
  const wid = Number.parseInt(ctx.warehouseId, 10);
  if (!ctx.warehouseId.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");
  if (ctx.isPolkiByOrder && ctx.polkiOrderIds.length < 1) throw new Error("polki_order");
  if (ctx.polkiUsesAutoBonus) {
    if (ctx.polkiAutoBonusPreviewPending) throw new Error("polki_bonus_preview_pending");
    if (ctx.polkiAutoBonusPreviewError) throw new Error("polki_bonus_preview_error");
    if (!ctx.polkiAutoBonusPreviewReady) throw new Error("polki_bonus_preview");
    if (
      isPolkiAutoBonusOverMax({
        rows: ctx.polkiRowsAll,
        polkiTotalQty: ctx.polkiTotalQty,
        explicitByPairKey: ctx.polkiAutoBonusExplicitByPairKey ?? {}
      })
    ) {
      throw new Error("polki_over_max");
    }
  }

  const { usePeriodBatch, batchLines, periodMerge, returnQtyByProduct, missingOrderId } =
    ctx.polkiSubmitSlice;
  if (missingOrderId) throw new Error("polki_missing_order");

  const noteParts: string[] = [];
  if (ctx.polkiHeaderDate.trim()) noteParts.push(`Дата заявки: ${ctx.polkiHeaderDate.trim()}`);
  if (ctx.polkiTradeDirection.trim()) {
    const td = tradeDirectionLabel(
      ctx.polkiTradeDirection,
      ctx.ctxProfile?.references?.trade_directions
    );
    noteParts.push(`Направление: ${td}`);
  }
  if (ctx.polkiSkidkaType !== "none") {
    const sd =
      POLKI_SKIDKA_OPTS.find((o) => o.value === ctx.polkiSkidkaType)?.label ?? ctx.polkiSkidkaType;
    noteParts.push(`Скидка: ${sd}`);
  }
  if (ctx.orderNotePreset.trim()) {
    const presetLabel =
      refEntryLabelByStored(ctx.ctxProfile?.references?.order_note_entries, ctx.orderNotePreset) ??
      ctx.orderNotePreset;
    noteParts.push(presetLabel);
  }
  if (ctx.orderComment.trim()) noteParts.push(ctx.orderComment.trim());
  const noteJoined = noteParts.join("\n").trim();

  if (usePeriodBatch) {
    if (batchLines.length === 0) throw new Error("nolines");
    const body: Record<string, unknown> = {
      client_id: cid,
      warehouse_id: wid,
      price_type: ctx.priceType.trim() || "retail",
      lines: batchLines
    };
    if (noteJoined) body.note = noteJoined;
    if (ctx.refusalReasonRefPolki.trim()) body.refusal_reason_ref = ctx.refusalReasonRefPolki.trim();
    if (ctx.polkiSubmitBonusDebt > 0) body.bonus_debt_amount = ctx.polkiSubmitBonusDebt;
    const batchRes = await api.post<{
      returns?: Array<{ discount_debt_amount?: string | null; discount_debt_note?: string | null }>;
    }>(`/api/${ctx.tenantSlug}/returns/period-batch`, body);
    const batchData = batchRes.data;
    const discDebt = (batchData.returns ?? []).reduce(
      (acc, r) => acc + parseDiscountDebtAmount(r.discount_debt_amount),
      0
    );
    const discNote = (batchData.returns ?? [])
      .map((r) => r.discount_debt_note)
      .find((n) => n && String(n).trim());
    return {
      bonusDebtApplied: ctx.polkiSubmitBonusDebt,
      discountDebtApplied: discDebt,
      discountDebtNote: discNote ?? null
    };
  }

  const submitBonusDebt = ctx.polkiSubmitBonusDebt;
  const lines = Array.from(periodMerge.entries())
    .map(([product_id, v]) => ({
      product_id,
      paid_qty: v.paid,
      bonus_qty: v.bonus,
      bonus_cash: v.cash,
      ...(ctx.polkiUsesAutoBonus ? { return_qty: returnQtyByProduct.get(product_id) } : {})
    }))
    .filter((l) => l.paid_qty + l.bonus_qty + l.bonus_cash > 0);
  if (lines.length === 0) throw new Error("nolines");

  const body: Record<string, unknown> = {
    client_id: cid,
    warehouse_id: wid,
    price_type: ctx.priceType.trim() || "retail",
    lines
  };
  if (ctx.isPolkiFree) {
    if (ctx.polkiDateFrom) body.date_from = ctx.polkiDateFrom;
    if (ctx.polkiDateTo) body.date_to = ctx.polkiDateTo;
  } else if (ctx.polkiOrderIds.length === 1) {
    body.order_id = ctx.polkiOrderIds[0];
  }
  if (noteJoined) body.note = noteJoined;
  if (ctx.refusalReasonRefPolki.trim()) body.refusal_reason_ref = ctx.refusalReasonRefPolki.trim();
  if (submitBonusDebt > 0) body.bonus_debt_amount = submitBonusDebt;
  const periodRes = await api.post<{
    discount_debt_amount?: string | null;
    discount_debt_note?: string | null;
  }>(`/api/${ctx.tenantSlug}/returns/period`, body);
  const periodData = periodRes.data;
  return {
    bonusDebtApplied: submitBonusDebt,
    discountDebtApplied: parseDiscountDebtAmount(periodData.discount_debt_amount),
    discountDebtNote: periodData.discount_debt_note ?? null
  };
}
