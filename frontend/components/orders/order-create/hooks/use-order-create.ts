"use client";

/**
 * OrderCreate thin composer (ADR-008 M1.4).
 * Wires OrderCreateDraft + PolkiReturnPolicy + OrderCreateBonusDebt → flat OrderCreateVm.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveLockedOrderAgentId } from "../order-edit-header";
import type { OrderCreateProps } from "../types";
import { useOrderCreateDraft } from "../draft/use-order-create-draft";
import { handleOrderCreateMutationError } from "../draft/draft.mutation-errors";
import {
  canSubmitExchangeBase,
  canSubmitOrdinaryBase
} from "../draft/draft.logic";
import { usePolkiReturnPolicy } from "../polki-policy/use-polki-return-policy";
import { runPolkiSubmit } from "../polki-policy/polki-submit";
import { polkiSubmitBlockedReason as computePolkiSubmitBlockedReason } from "../polki-policy/polki-return-policy.derived";
import type { PolkiPriceTypeEntryRef } from "../view/polki-shelf-return/polki-price-type-options";
import {
  useOrderCreateBonusDebt,
  type BonusConfirmPayload
} from "../bonus-debt/use-order-create-bonus-debt";

export function useOrderCreate(props: OrderCreateProps) {
  const qc = useQueryClient();
  const polkiResetRef = useRef<() => void>(() => {});
  const mutateBonusRef = useRef<(payload: BonusConfirmPayload) => void>(() => {});

  const draft = useOrderCreateDraft({
    ...props,
    onClientInvalidExtra: () => polkiResetRef.current()
  });

  const {
      tenantSlug,
    onCreated,
    isEditMode,
    editOrderId,
    isExchangeFlow,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    clientId,
    clientIdNum,
    warehouseId,
    priceType,
    productSearch,
    products,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    deepLinkClientId,
    deepLinkSourceOrderId,
    setClientId,
    setWarehouseId,
    setAgentId,
    setPriceType,
    setSelectionNotice,
    createCtxQ,
    setQtyByProductId,
    setBlockByProductId,
    buildOrdinarySubmit,
    buildExchangeSubmit,
    collectBonusPreviewItems,
    reportLocalError,
    setLocalError,
    clearOldPrices,
    setRequestTypeRef,
    setOrderNotePreset,
    setRefSelectKey,
    setOrderIsConsignment,
    setConsignmentDueDate,
    setConsignmentDueOpen,
    setPaymentMethodRef,
    hasClient,
    hasWarehouse,
    selectedItemsCount,
    loadingLists,
    editFormBlocked,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    requiresAgentAndPayment,
    agentId,
    agentUsers,
    editOrderQ,
    requiresPaymentMethodForSubmit,
    paymentMethodRef,
    canShowOrderCatalog,
    stockQ,
    exchangeReturnsQ,
    exchangePayloadCheck,
    applyBonus,
    ctxProfile
  } = draft;

  const polki = usePolkiReturnPolicy({
    tenantSlug,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    isExchangeFlow,
    clientId,
    clientIdNum,
    warehouseId,
    priceType,
    productSearch,
    products,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    deepLinkClientId,
    deepLinkSourceOrderId,
    setClientId,
    setWarehouseId,
    setAgentId,
    setPriceType,
    setSelectionNotice,
    priceTypeEntries: (createCtxQ.data?.settings_profile?.references?.price_type_entries ??
      []) as PolkiPriceTypeEntryRef[],
    fallbackPriceTypes: createCtxQ.data?.price_types ?? [],
    tradeDirections: createCtxQ.data?.settings_profile?.references?.trade_directions
  });

  polkiResetRef.current = () => {
    polki.resetOrderSelection();
  };

  useEffect(() => {
    if (!isPolkiSheet) return;
    setQtyByProductId({});
    setBlockByProductId({});
  }, [isPolkiSheet, polki.polkiDateFrom, polki.polkiDateTo, clientId, setQtyByProductId, setBlockByProductId]);

  const bonusDebt = useOrderCreateBonusDebt({
    tenantSlug,
    isEditMode,
    editOrderId,
    applyBonus,
    isPolkiSheet,
    isExchangeFlow,
    polkiUseAutoBonus: polki.polkiUsesAutoBonus,
    polkiAutoBonusDebtAmount: polki.polkiAutoBonusDebtAmount,
    polkiRows: polki.polkiRowsAll,
    polkiTotalQty: polki.polkiTotalQty,
    polkiBonusToBalance: polki.polkiBonusToBalance,
    polkiBonusCash: polki.polkiBonusCash,
    polkiExplicitByPairKey: polki.polkiAutoBonusExplicitByPairKey,
    onConfirmSave: (payload) => mutateBonusRef.current(payload)
  });

  const mutation = useMutation({
    mutationFn: async (
      bonusConfirm?: {
        bonus_gift_lines?: { bonus_rule_id: number; product_id: number; qty: number }[];
        bonus_strategy_selections?: { strategy_id: number; rule_ids: number[] }[];
      } | void
    ) => {
      if (isPolkiSheet) {
        return runPolkiSubmit({
          tenantSlug: tenantSlug!,
          clientId,
          warehouseId,
          priceType,
          orderComment: draft.orderComment,
          orderNotePreset: draft.orderNotePreset,
          isPolkiFree,
          isPolkiByOrder,
          polkiOrderIds: polki.polkiOrderIds,
          polkiUsesAutoBonus: polki.polkiUsesAutoBonus,
          polkiAutoBonusPreviewPending: polki.polkiAutoBonusPreviewPending,
          polkiAutoBonusPreviewError: polki.polkiAutoBonusPreviewQ.isError,
          polkiAutoBonusPreviewReady: polki.polkiAutoBonusPreviewReady,
          polkiRowsAll: polki.polkiRowsAll,
          polkiTotalQty: polki.polkiTotalQty,
          polkiAutoBonusExplicitByPairKey: polki.polkiAutoBonusExplicitByPairKey,
          polkiSubmitSlice: polki.polkiSubmitSlice,
          polkiHeaderDate: polki.polkiHeaderDate,
          polkiTradeDirection: polki.polkiTradeDirection,
          polkiSkidkaType: polki.polkiSkidkaType,
          refusalReasonRefPolki: polki.refusalReasonRefPolki,
          polkiDateFrom: polki.polkiDateFrom,
          polkiDateTo: polki.polkiDateTo,
          polkiSubmitBonusDebt: bonusDebt.polkiSubmitBonusDebt,
          ctxProfile
        });
      }
      if (isExchangeFlow) {
        await buildExchangeSubmit();
        return;
      }
      await buildOrdinarySubmit(bonusConfirm);
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["orders", "create-context", tenantSlug] });
      if (isEditMode && editOrderId != null) {
        void qc.invalidateQueries({ queryKey: ["order", tenantSlug, editOrderId] });
      }
      if (isPolkiSheet || isExchangeFlow) {
        void qc.invalidateQueries({ queryKey: ["returns", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["returns-client-data", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["exchange-returns", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["polki-auto-bonus-preview"] });
        void qc.invalidateQueries({ queryKey: ["order-create-polki-order-balances", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["order-create-polki-context", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["order-create-polki-orders", tenantSlug] });
      }
      if (isPolkiSheet && clientId.trim()) {
        const cid = Number.parseInt(clientId, 10);
        if (Number.isFinite(cid) && cid > 0) {
          void qc.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug, cid] });
          void qc.invalidateQueries({ queryKey: ["client-balance-movements", tenantSlug, cid] });
        }
      }
      const debtApplied =
        result &&
        typeof result === "object" &&
        "bonusDebtApplied" in result &&
        Number((result as { bonusDebtApplied?: number }).bonusDebtApplied) > 0
          ? Number((result as { bonusDebtApplied: number }).bonusDebtApplied)
          : 0;
      const discountDebtApplied =
        result &&
        typeof result === "object" &&
        "discountDebtApplied" in result &&
        Number((result as { discountDebtApplied?: number }).discountDebtApplied) > 0
          ? Number((result as { discountDebtApplied: number }).discountDebtApplied)
          : 0;
      const discountDebtNote =
        result &&
        typeof result === "object" &&
        "discountDebtNote" in result &&
        typeof (result as { discountDebtNote?: unknown }).discountDebtNote === "string"
          ? String((result as { discountDebtNote: string }).discountDebtNote).trim()
          : "";
      const notices: string[] = [];
      if (debtApplied > 0) {
        notices.push(
          `Долг бонус ${Math.round(debtApplied).toLocaleString("ru-RU")} сум — в «Балансы клиентов».`
        );
      }
      if (discountDebtApplied > 0) {
        notices.push(
          discountDebtNote
            ? discountDebtNote
            : `Долг скидка ${Math.round(discountDebtApplied).toLocaleString("ru-RU")} сум — в «Балансы клиентов» (после приёмки на складе).`
        );
      }
      if (notices.length > 0) setSelectionNotice(notices.join(" "));
      setRequestTypeRef("");
      setOrderNotePreset("");
      setRefSelectKey((k) => k + 1);
      setOrderIsConsignment(false);
      setConsignmentDueDate("");
      setConsignmentDueOpen(false);
      setPaymentMethodRef("");
      clearOldPrices();
      bonusDebt.resetBonusModal();
      onCreated();
    },
    onError: (e: Error) => {
      handleOrderCreateMutationError({
        e,
        isPolkiSheet,
        priceType,
        fail: reportLocalError,
        setLocalError
      });
    }
  });

  mutateBonusRef.current = (payload) => {
    mutation.mutate(payload);
  };

  const canUseCategoryChips = isPolkiSheet
    ? draft.canPickProducts || polki.canShowPolkiGrid
    : canShowOrderCatalog;

  const stockReadyForLines = isPolkiSheet
    ? !polki.polkiContextQ.isLoading && !polki.polkiContextQ.isError
    : !canShowOrderCatalog || (!stockQ.isLoading && !stockQ.isError);

  const hasAgentForSubmit =
    Boolean(agentId.trim()) ||
    (isEditMode &&
      Boolean(editOrderQ.data && resolveLockedOrderAgentId(editOrderQ.data, agentUsers)));

  const canSubmitBase = canSubmitOrdinaryBase({
    hasClient,
    hasWarehouse,
    selectedItemsCount,
    mutationPending: mutation.isPending,
    loadingLists,
    editFormBlocked,
    stockReadyForLines,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    requiresAgentAndPayment,
    hasAgent: hasAgentForSubmit,
    requiresPaymentMethodForSubmit,
    hasPaymentMethod: Boolean(paymentMethodRef.trim())
  });

  const canSubmit = isPolkiSheet
    ? Boolean(
        hasClient &&
          hasWarehouse &&
          polki.polkiContextQ.isSuccess &&
          polki.polkiSelectedLinesCount > 0 &&
          (polki.polkiTotalReturnQtySum > 0 || polki.polkiTotalBonusCashSum > 0) &&
          !polki.hasPolkiQtyOverMax &&
          !polki.hasPolkiBonusCashOverMax &&
          !mutation.isPending &&
          stockReadyForLines &&
          (isPolkiFree || (isPolkiByOrder && polki.polkiOrderIds.length > 0)) &&
          (!polki.polkiUsesAutoBonus ||
            (polki.polkiAutoBonusPreviewReady &&
              !polki.polkiAutoBonusPreviewPending &&
              !polki.polkiAutoBonusPreviewQ.isError))
      )
    : isExchangeFlow
      ? canSubmitExchangeBase({
          hasClient,
          hasWarehouse,
          hasAgent: Boolean(agentId.trim()),
          exchangeReturnsSuccess: exchangeReturnsQ.isSuccess,
          exchangePayloadOk: exchangePayloadCheck.ok,
          mutationPending: mutation.isPending,
          loadingLists
        })
      : canSubmitBase;

  const polkiSubmitBlockedReason = useMemo((): string | null => {
    const base = computePolkiSubmitBlockedReason({
      isPolkiSheet,
      mutationPending: mutation.isPending,
      hasClient,
      isPolkiByOrder,
      selectedOrderCount: polki.polkiOrderIds.length,
      hasWarehouse,
      contextLoading: polki.polkiContextQ.isLoading,
      contextError: polki.polkiContextQ.isError,
      contextSuccess: polki.polkiContextQ.isSuccess,
      selectedLinesCount: polki.polkiSelectedLinesCount,
      usesAutoBonus: polki.polkiUsesAutoBonus,
      autoBonusPending: polki.polkiAutoBonusPreviewPending,
      autoBonusError: polki.polkiAutoBonusPreviewQ.isError,
      autoBonusReady: polki.polkiAutoBonusPreviewReady,
      totalReturnQtySum: polki.polkiTotalReturnQtySum,
      totalBonusCashSum: polki.polkiTotalBonusCashSum,
      qtyOverMax: polki.hasPolkiQtyOverMax,
      bonusCashOverMax: polki.hasPolkiBonusCashOverMax
    });
    if (base) return base;
    if (!stockReadyForLines) return "Данные ещё не готовы…";
    return null;
  }, [
    isPolkiSheet,
    mutation.isPending,
    hasClient,
    isPolkiByOrder,
    polki.polkiOrderIds.length,
    hasWarehouse,
    polki.polkiContextQ.isLoading,
    polki.polkiContextQ.isError,
    polki.polkiContextQ.isSuccess,
    polki.polkiSelectedLinesCount,
    polki.polkiUsesAutoBonus,
    polki.polkiAutoBonusPreviewPending,
    polki.polkiAutoBonusPreviewReady,
    polki.polkiAutoBonusPreviewQ.isError,
    polki.polkiTotalReturnQtySum,
    polki.polkiTotalBonusCashSum,
    polki.hasPolkiQtyOverMax,
    polki.hasPolkiBonusCashOverMax,
    stockReadyForLines
  ]);

  const requestSubmit = useCallback(() => {
    if (!bonusDebt.needsWebBonusConfirm) {
      mutation.mutate(undefined);
      return;
    }
    const cid = Number.parseInt(clientId, 10);
    const warehouseRaw =
      warehouseId.trim() ||
      (draft.editSourceWarehouseId != null ? String(draft.editSourceWarehouseId) : "");
    const wid = Number.parseInt(warehouseRaw, 10);
    const agentParsed = agentId.trim() ? Number.parseInt(agentId, 10) : NaN;
    const agent_id = Number.isFinite(agentParsed) && agentParsed > 0 ? agentParsed : null;

    if (!Number.isFinite(cid) || cid < 1) {
      reportLocalError("Сначала выберите клиента", "client");
      return;
    }
    if (!warehouseRaw.trim() || !Number.isFinite(wid) || wid < 1) {
      reportLocalError("Сначала выберите склад", "warehouse");
      return;
    }
    if (agent_id == null) {
      reportLocalError("Агент обязателен", "agent");
      return;
    }

    const built = collectBonusPreviewItems();
    if (!built.ok) {
      if (built.reason === "qty") reportLocalError("Неверное количество", "catalog");
      else if (built.reason === "qty_over_stock") {
        reportLocalError("Недостаточно остатка на складе", "catalog");
      } else reportLocalError("Укажите количество хотя бы для одного товара", "catalog");
      return;
    }

    bonusDebt.openBonusPreview({
      clientId: cid,
      warehouseId: wid,
      agentId: agent_id,
      items: built.items,
      priceType,
      isConsignment: draft.orderIsConsignment,
      excludeOrderId: editOrderId
    });
  }, [
    bonusDebt,
    mutation,
    clientId,
    warehouseId,
    draft.editSourceWarehouseId,
    draft.orderIsConsignment,
    agentId,
    collectBonusPreviewItems,
    priceType,
    editOrderId,
    reportLocalError
  ]);

  const setErrorTarget = draft.setErrorTarget;
  useEffect(() => {
    setLocalError(null);
    setErrorTarget(null);
  }, [
    clientId,
    warehouseId,
    agentId,
    applyBonus,
    selectedCategoryIds,
    activeCatalogCategoryId,
    productSearch,
    draft.qtyByProductId,
    draft.expeditorUserId,
    priceType,
    draft.orderComment,
    draft.requestTypeRef,
    draft.orderNotePreset,
    polki.polkiHeaderDate,
    polki.polkiTradeDirection,
    polki.polkiSkidkaType,
    polki.refusalReasonRefPolki,
    polki.polkiOrderIdsSortedKey,
    paymentMethodRef,
    setLocalError,
    setErrorTarget
  ]);

  return {
    ...draft,
    ...polki,
    ...bonusDebt,
    qc,
    mutation,
    requestSubmit,
    canSubmit,
    canSubmitBase,
    canUseCategoryChips,
    stockReadyForLines,
    polkiSubmitBlockedReason,
    setPriceType: draft.setPriceType
  } as const;
}

export type OrderCreateVm = ReturnType<typeof useOrderCreate>;
