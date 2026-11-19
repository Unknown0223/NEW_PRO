/**
 * PolkiReturnPolicy — pure grid totals / gates (ADR-008 M1.3).
 */
import type { PolkiPairRowModel } from "../types";
import { parsePriceAmount } from "../utils";
import { maxReturnQty, parsePolkiQty, polkiSplitTotal } from "./polki-return-policy.logic";

export type PolkiGridDerivedInput = {
  isPolkiSheet: boolean;
  polkiUsesAutoBonus: boolean;
  polkiRowsAll: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  polkiBonusToBalance: Record<string, boolean>;
  polkiBonusCash: Record<string, string>;
  polkiBonusCashQty: Record<string, number>;
  polkiBonusGoodsQty: Record<string, number>;
  polkiAutoBonusExplicitByPairKey: Record<string, { paid: number; bonus: number }>;
  autoBonusTotals: { paid_qty: number; bonus_qty: number } | null | undefined;
  autoBonusRefundAmount: string | null | undefined;
};

export type PolkiGridDerived = {
  hasPolkiQtyOverMax: boolean;
  hasPolkiBonusCashOverMax: boolean;
  polkiTotalReturnQtySum: number;
  polkiEnteredTotalQtySum: number;
  polkiTotalBonusCashSum: number;
  polkiSelectedLinesCount: number;
  polkiEstimatedSum: number;
  polkiVolumeM3: number;
};

export function computePolkiGridDerived(input: PolkiGridDerivedInput): PolkiGridDerived {
  const {
    isPolkiSheet,
    polkiUsesAutoBonus,
    polkiRowsAll,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    polkiBonusCashQty,
    polkiBonusGoodsQty,
    polkiAutoBonusExplicitByPairKey,
    autoBonusTotals,
    autoBonusRefundAmount
  } = input;

  if (!isPolkiSheet) {
    return {
      hasPolkiQtyOverMax: false,
      hasPolkiBonusCashOverMax: false,
      polkiTotalReturnQtySum: 0,
      polkiEnteredTotalQtySum: 0,
      polkiTotalBonusCashSum: 0,
      polkiSelectedLinesCount: 0,
      polkiEstimatedSum: 0,
      polkiVolumeM3: 0
    };
  }

  let hasPolkiQtyOverMax = false;
  let hasPolkiBonusCashOverMax = false;
  let polkiEnteredTotalQtySum = 0;
  let polkiTotalReturnQtySum = 0;
  let polkiTotalBonusCashSum = 0;
  let polkiSelectedLinesCount = 0;
  let polkiEstimatedSum = 0;
  let polkiVolumeM3 = 0;

  if (polkiUsesAutoBonus && autoBonusTotals) {
    polkiTotalReturnQtySum = autoBonusTotals.paid_qty + autoBonusTotals.bonus_qty;
  }
  if (polkiUsesAutoBonus && autoBonusRefundAmount) {
    polkiEstimatedSum = Number.parseFloat(autoBonusRefundAmount) || 0;
  }

  for (const r of polkiRowsAll) {
    const pk = r.pair_key;
    const tr = polkiTotalQty[pk] ?? "";
    const total = parsePolkiQty(tr);
    if (tr.trim() && Number.isFinite(total) && total > 0 && total > maxReturnQty(r) + 1e-9) {
      hasPolkiQtyOverMax = true;
    }
    if (total > 0) polkiEnteredTotalQtySum += total;

    const ex = polkiUsesAutoBonus ? polkiAutoBonusExplicitByPairKey[pk] : undefined;
    const { effPaid, effBonus } = ex
      ? { effPaid: ex.paid, effBonus: ex.bonus }
      : polkiSplitTotal(r, total);
    const defer = polkiUsesAutoBonus ? false : Boolean(polkiBonusToBalance[pk]);
    let physBonus = defer ? 0 : effBonus;

    if (polkiUsesAutoBonus) {
      if (effPaid + effBonus > 0) polkiSelectedLinesCount++;
      const autoB = Math.max(0, Math.floor(effBonus));
      const cashUnits = Math.min(Math.max(0, Math.floor(polkiBonusCashQty[pk] ?? 0)), autoB);
      const goodsRaw = polkiBonusGoodsQty[pk];
      physBonus =
        goodsRaw != null
          ? Math.min(Math.max(0, Math.floor(goodsRaw)), autoB - cashUnits)
          : Math.max(0, autoB - cashUnits);
      if (autoBonusRefundAmount) {
        const unit = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;
        if (cashUnits > 0) polkiEstimatedSum += cashUnits * unit;
      }
      if (!autoBonusTotals) polkiTotalReturnQtySum += effPaid + (defer ? 0 : effBonus);
    } else {
      const bq = physBonus;
      const maxCash =
        r.max_bonus > 0
          ? defer
            ? r.max_bonus * r.unit_price_bonus
            : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus)
          : 0;
      const cash = r.max_bonus > 0 ? Math.min(parsePriceAmount(polkiBonusCash[pk] ?? ""), maxCash) : 0;
      if (cash > maxCash + 1e-6) hasPolkiBonusCashOverMax = true;
      polkiTotalBonusCashSum += cash;
      polkiTotalReturnQtySum += effPaid + bq;
      if (effPaid + bq + cash > 0) polkiSelectedLinesCount++;
      polkiEstimatedSum += effPaid * r.unit_price_paid + cash;
    }

    const vol = r.volume_m3 != null ? Number.parseFloat(String(r.volume_m3)) : NaN;
    if (Number.isFinite(vol) && effPaid + physBonus > 0) {
      polkiVolumeM3 += (effPaid + physBonus) * vol;
    }
  }

  return {
    hasPolkiQtyOverMax,
    hasPolkiBonusCashOverMax: polkiUsesAutoBonus ? false : hasPolkiBonusCashOverMax,
    polkiTotalReturnQtySum,
    polkiEnteredTotalQtySum,
    polkiTotalBonusCashSum: polkiUsesAutoBonus ? 0 : polkiTotalBonusCashSum,
    polkiSelectedLinesCount,
    polkiEstimatedSum,
    polkiVolumeM3
  };
}

export type PolkiSubmitBlockedInput = {
  isPolkiSheet: boolean;
  mutationPending: boolean;
  hasClient: boolean;
  hasWarehouse: boolean;
  isPolkiByOrder: boolean;
  selectedOrderCount: number;
  contextLoading: boolean;
  contextError: boolean;
  contextSuccess: boolean;
  selectedLinesCount: number;
  usesAutoBonus: boolean;
  autoBonusPending: boolean;
  autoBonusError: boolean;
  autoBonusReady: boolean;
  totalReturnQtySum: number;
  totalBonusCashSum: number;
  qtyOverMax: boolean;
  bonusCashOverMax: boolean;
};

export function polkiSubmitBlockedReason(input: PolkiSubmitBlockedInput): string | null {
  if (!input.isPolkiSheet || input.mutationPending) return null;
  if (!input.hasClient) return "Выберите клиента.";
  if (input.isPolkiByOrder && input.selectedOrderCount === 0) {
    return "В блоке «Выбор заказа» справа выберите один доставленный заказ.";
  }
  if (!input.hasWarehouse) return "Выберите склад возврата (блок «Параметры возврата»).";
  if (input.contextLoading) return "Загрузка состава возврата…";
  if (input.contextError) {
    return "Не удалось загрузить состав. Проверьте клиента, заказы и сеть.";
  }
  if (!input.contextSuccess) return "Ожидание данных для возврата…";
  if (input.selectedLinesCount === 0) {
    return "В «Состав заявки» введите количество к возврату или сумму компенсации бонуса хотя бы в одной строке.";
  }
  if (input.usesAutoBonus && input.selectedLinesCount > 0) {
    if (input.autoBonusPending) return "Дождитесь расчёта бонуса…";
    if (input.autoBonusError) {
      return "Не удалось рассчитать бонус. Проверьте сеть и количества.";
    }
    if (!input.autoBonusReady) return "Дождитесь расчёта бонуса по строкам.";
  }
  if (input.totalReturnQtySum <= 0 && input.totalBonusCashSum <= 0) {
    return "Суммарно к возврату 0: укажите шт в колонке «всего к возврату».";
  }
  if (input.qtyOverMax) {
    return "В строке больше, чем по заказу (см. «макс. всего») — уменьшите количество.";
  }
  if (input.bonusCashOverMax) {
    return "Сумма компенсации бонуса превышает допустимое значение для строки.";
  }
  if (input.contextLoading || input.contextError) return "Данные ещё не готовы…";
  return null;
}
