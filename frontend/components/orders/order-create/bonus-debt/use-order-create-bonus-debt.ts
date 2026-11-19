"use client";

/**
 * OrderCreateBonusDebt — deep module hook (ADR-008 M1.2).
 * Public: openBonusPreview · confirmBonus · computeDebtAmounts · modal state.
 */
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useCallback, useMemo, useState } from "react";
import {
  shouldConfirmBonusOnWebNewEdit,
  type OrderBonusPreviewResponse
} from "../order-edit-bonus-confirm.logic";
import type { PolkiPairRowModel } from "../types";
import { computeDebtAmounts, type DebtAmounts } from "./bonus-debt.logic";

export type BonusConfirmPayload = {
  bonus_gift_lines: { bonus_rule_id: number; product_id: number; qty: number }[];
  bonus_strategy_selections: { strategy_id: number; rule_ids: number[] }[];
};

export type OpenBonusPreviewInput = {
  clientId: number;
  warehouseId: number;
  agentId: number;
  items: { product_id: number; qty: number }[];
  priceType: string;
  isConsignment: boolean;
  excludeOrderId?: number | null;
};

export type UseOrderCreateBonusDebtArgs = {
  tenantSlug: string | null | undefined;
  isEditMode: boolean;
  editOrderId: number | null | undefined;
  applyBonus: boolean;
  isPolkiSheet: boolean;
  isExchangeFlow: boolean;
  /** Polki debt inputs (isPolkiSheet=false bo‘lsa e’tiborsiz). */
  polkiUseAutoBonus?: boolean;
  polkiAutoBonusDebtAmount?: number;
  polkiRows?: PolkiPairRowModel[];
  polkiTotalQty?: Record<string, string>;
  polkiBonusToBalance?: Record<string, boolean>;
  polkiBonusCash?: Record<string, string>;
  polkiExplicitByPairKey?: Record<string, { paid: number; bonus: number }>;
  /** Composer mutation.mutate — confirmBonus shu orqali. */
  onConfirmSave: (payload: BonusConfirmPayload) => void;
};

export function useOrderCreateBonusDebt(args: UseOrderCreateBonusDebtArgs) {
  const {
    tenantSlug,
    isEditMode,
    editOrderId,
    applyBonus,
    isPolkiSheet,
    isExchangeFlow,
    polkiUseAutoBonus = false,
    polkiAutoBonusDebtAmount = 0,
    polkiRows = [],
    polkiTotalQty = {},
    polkiBonusToBalance = {},
    polkiBonusCash = {},
    polkiExplicitByPairKey,
    onConfirmSave
  } = args;

  const [bonusConfirmOpen, setBonusConfirmOpen] = useState(false);
  const [bonusPreviewLoading, setBonusPreviewLoading] = useState(false);
  const [bonusPreviewError, setBonusPreviewError] = useState<string | null>(null);
  const [bonusPreview, setBonusPreview] = useState<OrderBonusPreviewResponse | null>(null);

  const needsWebBonusConfirm = shouldConfirmBonusOnWebNewEdit({
    isEditMode,
    hasEditOrderId: editOrderId != null,
    applyBonus,
    isPolkiSheet,
    isExchangeFlow
  });

  const debtAmounts: DebtAmounts = useMemo(() => {
    if (!isPolkiSheet) {
      return computeDebtAmounts({ kind: "ordinary" });
    }
    return computeDebtAmounts({
      kind: "polki",
      useAutoBonus: polkiUseAutoBonus,
      autoBonusDebtAmount: polkiAutoBonusDebtAmount,
      rows: polkiRows,
      polkiTotalQty,
      polkiBonusToBalance,
      polkiBonusCash,
      explicitByPairKey: polkiExplicitByPairKey
    });
  }, [
    isPolkiSheet,
    polkiUseAutoBonus,
    polkiAutoBonusDebtAmount,
    polkiRows,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    polkiExplicitByPairKey
  ]);

  const computeDebtAmountsFn = useCallback((): DebtAmounts => debtAmounts, [debtAmounts]);

  const resetBonusModal = useCallback(() => {
    setBonusConfirmOpen(false);
    setBonusPreview(null);
    setBonusPreviewError(null);
    setBonusPreviewLoading(false);
  }, []);

  const openBonusPreview = useCallback(
    (input: OpenBonusPreviewInput) => {
      if (!tenantSlug) return;
      setBonusConfirmOpen(true);
      setBonusPreview(null);
      setBonusPreviewError(null);
      setBonusPreviewLoading(true);
      void (async () => {
        try {
          const { data } = await api.post<OrderBonusPreviewResponse>(
            `/api/${tenantSlug}/orders/bonus-preview`,
            {
              client_id: input.clientId,
              warehouse_id: input.warehouseId,
              agent_id: input.agentId,
              price_type: input.priceType.trim() || "retail",
              items: input.items,
              is_consignment: input.isConsignment,
              exclude_order_id: input.excludeOrderId ?? undefined
            }
          );
          setBonusPreview(data);
        } catch (e) {
          setBonusPreviewError(
            getUserFacingError(e, "Не удалось получить предпросмотр бонуса. Повторите попытку.")
          );
        } finally {
          setBonusPreviewLoading(false);
        }
      })();
    },
    [tenantSlug]
  );

  const confirmBonus = useCallback(
    (payload: BonusConfirmPayload) => {
      onConfirmSave(payload);
    },
    [onConfirmSave]
  );

  return {
    openBonusPreview,
    confirmBonus,
    /** View Vm alias (tekis Vm). */
    confirmBonusAndSave: confirmBonus,
    computeDebtAmounts: computeDebtAmountsFn,
    needsWebBonusConfirm,
    bonusConfirmOpen,
    setBonusConfirmOpen,
    bonusPreview,
    bonusPreviewLoading,
    bonusPreviewError,
    polkiDebtHintSum: debtAmounts.debtHintSum,
    polkiSubmitBonusDebt: debtAmounts.bonusDebt,
    resetBonusModal
  };
}

export type OrderCreateBonusDebtApi = ReturnType<typeof useOrderCreateBonusDebt>;
