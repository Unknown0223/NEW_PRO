"use client";

/**
 * PolkiReturnPolicy — public facade (ADR-008 M1.3).
 * `polkiReturnMode` = free/by_order (route). `setMode` = bonus calc manual|auto.
 */
import { getUserFacingError } from "@/lib/error-utils";
import { checkShelfReturnByOrder } from "@/lib/shelf-return-by-order";
import { polkiReturnEmptyListMessage } from "@/lib/return-filter-messages";
import type { ProductRow } from "@/lib/product-types";
import { useCallback, useEffect, useMemo } from "react";
import type { PolkiClientItem } from "../types";
import { polkiDefaultsFromOrderRow } from "../view/polki-shelf-return/polki-apply-order-defaults";
import type { PolkiPriceTypeEntryRef } from "../view/polki-shelf-return/polki-price-type-options";
import { tradeDirectionOptionsFromProfile } from "../view/polki-shelf-return/polki-trade-direction-options";
import {
  polkiReturnModeFromType,
  type PolkiReturnMode
} from "../view/polki-shelf-return/polki-return-mode";
import {
  buildPolkiSubmitSlice,
  maxReturnQty,
  productMaxReturn,
  rebalanceComposition,
  setReturnQtyCapped
} from "./polki-return-policy.logic";
import { usePolkiReturnPolicyComposition } from "./use-polki-return-policy-composition";
import { usePolkiReturnPolicyData } from "./use-polki-return-policy-data";

export type UsePolkiReturnPolicyArgs = {
  tenantSlug: string | null | undefined;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  isPolkiSheet: boolean;
  isExchangeFlow: boolean;
  clientId: string;
  clientIdNum: number;
  warehouseId: string;
  priceType: string;
  productSearch: string;
  products: ProductRow[];
  categories: { id: number; name: string }[];
  selectedCategoryIds: number[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<number[]>>;
  activeCatalogCategoryId: number | null;
  setActiveCatalogCategoryId: (v: number | null) => void;
  deepLinkClientId: number | null;
  deepLinkSourceOrderId: number | null;
  setClientId: (v: string) => void;
  setWarehouseId: (v: string) => void;
  setAgentId: (v: string) => void;
  setPriceType: (v: string) => void;
  setSelectionNotice: (msg: string | null) => void;
  priceTypeEntries: PolkiPriceTypeEntryRef[] | undefined;
  fallbackPriceTypes: string[];
  tradeDirections: unknown;
};

export function usePolkiReturnPolicy(args: UsePolkiReturnPolicyArgs) {
  const {
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
    priceTypeEntries,
    fallbackPriceTypes,
    tradeDirections
  } = args;

  const polkiReturnMode: PolkiReturnMode = isPolkiByOrder
    ? "by_order"
    : polkiReturnModeFromType(isPolkiFree ? "return" : "order");

  const onOrderDefaults = useCallback(
    (patch: { warehouseId: string; agentId: string; priceType: string }) => {
      if (patch.warehouseId) setWarehouseId(patch.warehouseId);
      if (patch.agentId) setAgentId(patch.agentId);
      setPriceType(patch.priceType);
    },
    [setWarehouseId, setAgentId, setPriceType]
  );

  const data = usePolkiReturnPolicyData({
    tenantSlug,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    isExchangeFlow,
    clientId,
    clientIdNum,
    deepLinkClientId,
    setClientId
  });

  const composition = usePolkiReturnPolicyComposition({
    tenantSlug,
    isPolkiSheet,
    isPolkiFree,
    isPolkiByOrder,
    clientId,
    warehouseId,
    priceType,
    productSearch,
    products,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    polkiDateFrom: data.polkiDateFrom,
    polkiDateTo: data.polkiDateTo,
    polkiOrderIds: data.polkiOrderIds,
    polkiContextItems: data.polkiContextQ.data?.items as PolkiClientItem[] | undefined,
    polkiContextLoading: data.polkiContextQ.isLoading,
    polkiContextSuccess: data.polkiContextQ.isSuccess,
    polkiOrderDateById: data.polkiOrderDateById,
    polkiAutoCategoriesOrderRef: data.polkiAutoCategoriesOrderRef
  });

  const {
    setPolkiOrderIds,
    polkiAutoCategoriesOrderRef,
    polkiOrdersForPick,
    polkiDeepLinkAppliedRef,
    polkiOrdersPickQ,
    polkiOrderBalancesQ,
    polkiOrderFilterMeta,
    polkiOrdersPickRawCount,
    resetOrderSelection
  } = data;

  const {
    setPolkiExpandedOrderId,
    clearLineMaps,
    setPolkiTradeDirection,
    setPolkiSkidkaType,
    setPolkiBonusCalcMode,
    polkiRowsAll,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    polkiBonusGoodsQty,
    polkiBonusCashQty,
    polkiPeresortByPairKey,
    polkiAutoBonusExplicitByPairKey,
    polkiAutoBonusPeresortByPairKey,
    polkiUsesAutoBonus,
    polkiBonusCalcMode
  } = composition;

  const selectOrders = useCallback(
    (id: number) => {
      setPolkiOrderIds([id]);
      setPolkiExpandedOrderId(id);
      polkiAutoCategoriesOrderRef.current = null;
      clearLineMaps();
      setSelectionNotice(null);

      const order = polkiOrdersForPick.find((o) => o.id === id);
      if (!order) return;

      const patch = polkiDefaultsFromOrderRow(order, {
        priceTypeEntries,
        fallbackPriceTypes,
        tradeDirectionOptions: tradeDirectionOptionsFromProfile(
          Array.isArray(tradeDirections) ? (tradeDirections as string[]) : undefined
        )
      });

      onOrderDefaults({
        warehouseId: patch.warehouseId,
        agentId: patch.agentId,
        priceType: patch.priceType
      });
      setPolkiTradeDirection(patch.tradeDirection);
      setPolkiSkidkaType(patch.skidkaType);
      setPolkiBonusCalcMode(patch.bonusCalcMode);
    },
    [
      setPolkiOrderIds,
      setPolkiExpandedOrderId,
      polkiAutoCategoriesOrderRef,
      clearLineMaps,
      setSelectionNotice,
      polkiOrdersForPick,
      priceTypeEntries,
      fallbackPriceTypes,
      tradeDirections,
      onOrderDefaults,
      setPolkiTradeDirection,
      setPolkiSkidkaType,
      setPolkiBonusCalcMode
    ]
  );

  const selectPolkiOrder = selectOrders;

  useEffect(() => {
    if (!isPolkiByOrder || deepLinkSourceOrderId == null) return;
    if (polkiDeepLinkAppliedRef.current) return;
    if (!tenantSlug?.trim()) return;
    if (!Number.isFinite(clientIdNum) || clientIdNum < 1) return;
    if (deepLinkClientId != null && clientIdNum !== deepLinkClientId) return;
    if (polkiOrdersPickQ.isLoading || polkiOrderBalancesQ.isLoading) return;
    if (!polkiOrdersPickQ.isSuccess || !polkiOrderBalancesQ.isSuccess) return;

    polkiDeepLinkAppliedRef.current = true;
    const eligible = polkiOrdersForPick.some((o) => o.id === deepLinkSourceOrderId);
    if (eligible) {
      selectOrders(deepLinkSourceOrderId);
      return;
    }

    void checkShelfReturnByOrder(tenantSlug, clientIdNum, deepLinkSourceOrderId)
      .then((result) => {
        if (result.allowed) {
          selectOrders(deepLinkSourceOrderId);
          return;
        }
        setSelectionNotice(
          result.message?.trim() ||
            polkiReturnEmptyListMessage({
              filterMeta: polkiOrderFilterMeta,
              deliveredOrdersCount: polkiOrdersPickRawCount,
              returnableCount: polkiOrdersForPick.length,
              isByOrder: true
            })
        );
      })
      .catch((e) => {
        setSelectionNotice(
          getUserFacingError(e, "Не удалось открыть возврат по заказу. Проверьте фильтр и баланс.")
        );
      });
  }, [
    isPolkiByOrder,
    deepLinkSourceOrderId,
    deepLinkClientId,
    tenantSlug,
    clientIdNum,
    polkiDeepLinkAppliedRef,
    polkiOrdersPickQ.isLoading,
    polkiOrdersPickQ.isSuccess,
    polkiOrderBalancesQ.isLoading,
    polkiOrderBalancesQ.isSuccess,
    polkiOrdersForPick,
    polkiOrderFilterMeta,
    polkiOrdersPickRawCount,
    selectOrders,
    setSelectionNotice
  ]);

  const polkiSubmitSlice = useMemo(
    () =>
      buildPolkiSubmitSlice({
        rows: polkiRowsAll,
        polkiTotalQty,
        polkiBonusToBalance,
        polkiBonusCash,
        polkiBonusGoodsQty,
        polkiBonusCashQty,
        polkiPeresortByPairKey,
        polkiAutoBonusExplicitByPairKey,
        polkiAutoBonusPeresortByPairKey,
        polkiUsesAutoBonus,
        isPolkiFree,
        isPolkiByOrder,
        polkiBonusCalcMode
      }),
    [
      polkiRowsAll,
      polkiTotalQty,
      polkiBonusToBalance,
      polkiBonusCash,
      polkiBonusGoodsQty,
      polkiBonusCashQty,
      polkiPeresortByPairKey,
      polkiAutoBonusExplicitByPairKey,
      polkiAutoBonusPeresortByPairKey,
      polkiUsesAutoBonus,
      polkiBonusCalcMode,
      isPolkiFree,
      isPolkiByOrder
    ]
  );

  return {
    ...composition,
    canShowPolkiGrid: composition.canShowPolkiGrid,
    setReturnQty: composition.setReturnQty,
    setPolkiTotalQty: composition.setPolkiTotalQty,
    polkiReturnMode,
    /** Bonus calc mode (manual|auto) — Spec `setMode`. */
    setMode: composition.setPolkiBonusCalcMode,
    selectOrders,
    selectPolkiOrder,
    rebalanceComposition,
    maxReturnQty,
    productMaxReturn,
    setReturnQtyCapped,
    buildPolkiSubmitSlice,
    polkiSubmitSlice,
    resetOrderSelection,
    polkiDateFrom: data.polkiDateFrom,
    setPolkiDateFrom: data.setPolkiDateFrom,
    polkiDateTo: data.polkiDateTo,
    setPolkiDateTo: data.setPolkiDateTo,
    setDates: data.setDates,
    setPolkiDateFromTo: data.setDates,
    polkiRangeAnchorRef: data.polkiRangeAnchorRef,
    polkiRangeOpen: data.polkiRangeOpen,
    setPolkiRangeOpen: data.setPolkiRangeOpen,
    polkiOrderIds: data.polkiOrderIds,
    setPolkiOrderIds: data.setPolkiOrderIds,
    polkiOrderIdsSortedKey: data.polkiOrderIdsSortedKey,
    polkiOrderIdSet: data.polkiOrderIdSet,
    polkiHeaderDate: data.polkiHeaderDate,
    setPolkiHeaderDate: data.setPolkiHeaderDate,
    polkiOrdersPickQ: data.polkiOrdersPickQ,
    polkiOrderBalancesQ: data.polkiOrderBalancesQ,
    polkiOrderFilterMeta: data.polkiOrderFilterMeta,
    polkiOrdersForPick: data.polkiOrdersForPick,
    polkiOrdersPickRawCount: data.polkiOrdersPickRawCount,
    polkiOrderPickHalfLists: data.polkiOrderPickHalfLists,
    polkiOrderFieldsFromOrder: data.polkiOrderFieldsFromOrder,
    polkiContextQ: data.polkiContextQ,
    polkiOrderBalanceById: data.polkiOrderBalanceById,
    polkiSelectedOrderBalance: data.polkiSelectedOrderBalance,
    polkiOrderDateById: data.polkiOrderDateById
  };
}
