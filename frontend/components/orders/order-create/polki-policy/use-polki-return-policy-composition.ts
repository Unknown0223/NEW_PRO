"use client";
/**
 * PolkiReturnPolicy — rows / qty / filters / totals / auto-bonus (ADR-008 M1.3).
 */
import type { ProductRow } from "@/lib/product-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PolkiClientItem, PolkiOrderGroup, PolkiPairRowModel } from "../types";
import { usePolkiAutoBonus } from "../hooks/use-polki-auto-bonus";
import { usePolkiPeresort } from "../hooks/use-polki-peresort";
import { computePolkiGridDerived } from "./polki-return-policy.derived";
import {
  buildPolkiRows,
  canShowPolkiGrid as canShowPolkiGridPure,
  parsePolkiQty,
  setReturnQtyCapped
} from "./polki-return-policy.logic";

export type UsePolkiReturnPolicyCompositionArgs = {
  tenantSlug: string | null | undefined;
  isPolkiSheet: boolean;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  clientId: string;
  warehouseId: string;
  priceType: string;
  productSearch: string;
  products: ProductRow[];
  categories: { id: number; name: string }[];
  selectedCategoryIds: number[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<number[]>>;
  activeCatalogCategoryId: number | null;
  setActiveCatalogCategoryId: (v: number | null) => void;
  polkiDateFrom: string;
  polkiDateTo: string;
  polkiOrderIds: number[];
  polkiContextItems: PolkiClientItem[] | undefined;
  polkiContextLoading: boolean;
  polkiContextSuccess: boolean;
  polkiOrderDateById: Map<number, string>;
  polkiAutoCategoriesOrderRef: React.MutableRefObject<number | null>;
};

export function usePolkiReturnPolicyComposition(args: UsePolkiReturnPolicyCompositionArgs) {
  const {
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
    polkiDateFrom,
    polkiDateTo,
    polkiOrderIds,
    polkiContextItems,
    polkiContextLoading,
    polkiContextSuccess,
    polkiOrderDateById,
    polkiAutoCategoriesOrderRef
  } = args;

  const [polkiTotalQty, setPolkiTotalQty] = useState<Record<string, string>>({});
  const [polkiBonusToBalance, setPolkiBonusToBalance] = useState<Record<string, boolean>>({});
  const [polkiBonusCash, setPolkiBonusCash] = useState<Record<string, string>>({});
  const [polkiBonusGoodsQty, setPolkiBonusGoodsQty] = useState<Record<string, number>>({});
  const [polkiBonusCashQty, setPolkiBonusCashQty] = useState<Record<string, number>>({});
  const [refusalReasonRefPolki, setRefusalReasonRefPolki] = useState("");
  const [polkiTradeDirection, setPolkiTradeDirection] = useState("");
  const [polkiSkidkaType, setPolkiSkidkaType] = useState("none");
  const [polkiExpandedOrderId, setPolkiExpandedOrderId] = useState<number | null>(null);
  const [polkiBonusCalcMode, setPolkiBonusCalcMode] = useState<"manual" | "auto">("auto");
  const [polkiPeresortByPairKey, setPolkiPeresortByPairKey] = useState<Record<string, number>>({});

  const clearLineMaps = useCallback(() => {
    setPolkiTotalQty({});
    setPolkiPeresortByPairKey({});
    setPolkiBonusToBalance({});
    setPolkiBonusCash({});
    setPolkiBonusGoodsQty({});
    setPolkiBonusCashQty({});
  }, []);

  useEffect(() => {
    if (!isPolkiSheet) return;
    clearLineMaps();
  }, [isPolkiSheet, polkiDateFrom, polkiDateTo, clientId, clearLineMaps]);

  const { polkiPeresortOptionsByProductId } = usePolkiPeresort(
    tenantSlug ?? null,
    isPolkiSheet
  );

  const polkiRowsAll = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet || !polkiContextItems?.length) return [];
    return buildPolkiRows({ items: polkiContextItems, products, isPolkiFree });
  }, [isPolkiSheet, isPolkiFree, polkiContextItems, products]);

  const polkiLineKeySet = useMemo(
    () => new Set(polkiRowsAll.map((r) => r.pair_key)),
    [polkiRowsAll]
  );

  useEffect(() => {
    if (!isPolkiSheet) return;
    const prune = <T,>(prev: Record<string, T>): Record<string, T> => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!polkiLineKeySet.has(k)) delete next[k];
      }
      return next;
    };
    setPolkiTotalQty((p) => prune(p));
    setPolkiBonusCash((p) => prune(p));
    setPolkiBonusToBalance((p) => prune(p));
  }, [isPolkiSheet, polkiLineKeySet]);

  const polkiReturnCategories = useMemo(() => {
    if (!isPolkiSheet) return null;
    if (polkiContextLoading) return null;
    if (!polkiContextSuccess) return [];
    if (polkiRowsAll.length === 0) return [];
    const ids = new Set<number>();
    for (const r of polkiRowsAll) {
      if (r.category_id != null && Number.isFinite(r.category_id)) ids.add(r.category_id);
    }
    return categories
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [isPolkiSheet, polkiContextLoading, polkiContextSuccess, polkiRowsAll, categories]);

  useEffect(() => {
    if (!isPolkiSheet || polkiReturnCategories == null) return;
    const allowed = new Set(polkiReturnCategories.map((c) => c.id));
    setSelectedCategoryIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [isPolkiSheet, polkiReturnCategories, setSelectedCategoryIds]);

  useEffect(() => {
    if (!isPolkiByOrder || polkiOrderIds.length !== 1) return;
    if (!polkiReturnCategories?.length) return;
    const oid = polkiOrderIds[0]!;
    if (polkiAutoCategoriesOrderRef.current === oid) return;
    polkiAutoCategoriesOrderRef.current = oid;
    const ids = polkiReturnCategories.map((c) => c.id);
    setSelectedCategoryIds(ids);
    setActiveCatalogCategoryId(ids[0] ?? null);
  }, [
    isPolkiByOrder,
    polkiOrderIds,
    polkiReturnCategories,
    polkiAutoCategoriesOrderRef,
    setSelectedCategoryIds,
    setActiveCatalogCategoryId
  ]);

  const categoryFilterActive = selectedCategoryIds.length > 0;

  const polkiRowsFiltered = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet || !categoryFilterActive) return [];
    const activeId = activeCatalogCategoryId ?? selectedCategoryIds[0];
    if (activeId == null) return [];
    return polkiRowsAll.filter((r) => {
      const cid = r.category_id;
      if (cid == null || !Number.isFinite(cid)) return false;
      if (!selectedCategoryIds.includes(cid)) return false;
      return cid === activeId;
    });
  }, [isPolkiSheet, polkiRowsAll, categoryFilterActive, activeCatalogCategoryId, selectedCategoryIds]);

  const polkiDisplayRows = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet) return [];
    const n = productSearch.trim().toLowerCase();
    if (!n) return polkiRowsFiltered;
    return polkiRowsFiltered.filter(
      (r) => r.name.toLowerCase().includes(n) || (r.sku ?? "").toLowerCase().includes(n)
    );
  }, [isPolkiSheet, polkiRowsFiltered, productSearch]);

  const canShowPolkiGrid = canShowPolkiGridPure({
    isPolkiSheet,
    hasClient: Boolean(clientId.trim()),
    hasWarehouse: Boolean(warehouseId.trim()),
    isPolkiFree,
    isPolkiByOrder,
    selectedOrderCount: polkiOrderIds.length
  });

  const {
    polkiAutoBonusPreviewQ,
    polkiAutoBonusExplicitByPairKey,
    polkiAutoBonusPeresortByPairKey,
    polkiAutoBonusDebtAmount,
    polkiAutoBonusDebtByPairKey,
    polkiAutoBonusPreviewReady,
    polkiAutoBonusPreviewPending
  } = usePolkiAutoBonus({
    tenantSlug: tenantSlug ?? null,
    isPolkiFree,
    isPolkiByOrder,
    polkiOrderId: isPolkiByOrder ? (polkiOrderIds[0] ?? null) : null,
    polkiDateFrom,
    polkiDateTo,
    polkiBonusCalcMode,
    canShowPolkiGrid,
    clientId,
    priceType,
    selectedCategoryIds,
    polkiDisplayRows,
    polkiTotalQty
  });

  const polkiUsesAutoBonus = isPolkiFree || isPolkiByOrder;

  const polkiAutoBonusPreviewLinesByProductId = useMemo(() => {
    const m = new Map<number, import("../hooks/use-polki-auto-bonus").PolkiAutoBonusPreviewLine>();
    for (const l of polkiAutoBonusPreviewQ.data?.lines ?? []) m.set(l.product_id, l);
    return m;
  }, [polkiAutoBonusPreviewQ.data]);

  const polkiOrderGroups = useMemo((): PolkiOrderGroup[] => {
    if (!isPolkiSheet) return [];
    if (isPolkiFree) {
      if (polkiDisplayRows.length === 0) return [];
      return [{ orderId: 0, orderNumber: "", orderDate: "", rows: polkiDisplayRows }];
    }
    const byOrder = new Map<number, PolkiPairRowModel[]>();
    for (const r of polkiDisplayRows) {
      const arr = byOrder.get(r.order_id) ?? [];
      arr.push(r);
      byOrder.set(r.order_id, arr);
    }
    return Array.from(byOrder.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([orderId, rows]) => ({
        orderId,
        orderNumber: rows[0]?.order_number ?? String(orderId),
        orderDate: polkiOrderDateById.get(orderId) ?? "",
        rows
      }));
  }, [isPolkiSheet, isPolkiFree, polkiDisplayRows, polkiOrderDateById]);

  useEffect(() => {
    if (!isPolkiSheet || isPolkiFree) return;
    const ids = polkiOrderGroups.map((g) => g.orderId);
    if (ids.length === 0) {
      setPolkiExpandedOrderId(null);
      return;
    }
    setPolkiExpandedOrderId((prev) =>
      prev !== null && ids.includes(prev) ? prev : (ids[0] ?? null)
    );
  }, [isPolkiSheet, isPolkiFree, polkiOrderGroups]);

  const gridDerived = useMemo(
    () =>
      computePolkiGridDerived({
        isPolkiSheet,
        polkiUsesAutoBonus,
        polkiRowsAll,
        polkiTotalQty,
        polkiBonusToBalance,
        polkiBonusCash,
        polkiBonusCashQty,
        polkiBonusGoodsQty,
        polkiAutoBonusExplicitByPairKey,
        autoBonusTotals: polkiAutoBonusPreviewQ.data?.totals,
        autoBonusRefundAmount: polkiAutoBonusPreviewQ.data?.totals.refund_amount
      }),
    [
      isPolkiSheet,
      polkiUsesAutoBonus,
      polkiRowsAll,
      polkiTotalQty,
      polkiBonusToBalance,
      polkiBonusCash,
      polkiBonusCashQty,
      polkiBonusGoodsQty,
      polkiAutoBonusExplicitByPairKey,
      polkiAutoBonusPreviewQ.data?.totals
    ]
  );

  const setReturnQty = useCallback(
    (pairKey: string, qty: number | string, row?: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">) => {
      const n = typeof qty === "number" ? qty : parsePolkiQty(String(qty));
      const capped = row ? setReturnQtyCapped(row, n) : n;
      setPolkiTotalQty((prev) => ({ ...prev, [pairKey]: String(capped) }));
    },
    []
  );

  const setPolkiBonusSplit = useCallback(
    (pairKey: string, next: { goodsQty: number; cashQty: number }) => {
      setPolkiBonusGoodsQty((prev) => ({ ...prev, [pairKey]: next.goodsQty }));
      setPolkiBonusCashQty((prev) => ({ ...prev, [pairKey]: next.cashQty }));
    },
    []
  );

  return {
    polkiTotalQty,
    setPolkiTotalQty,
    setReturnQty,
    polkiBonusToBalance,
    setPolkiBonusToBalance,
    polkiBonusCash,
    setPolkiBonusCash,
    polkiBonusGoodsQty,
    setPolkiBonusGoodsQty,
    polkiBonusCashQty,
    setPolkiBonusCashQty,
    setPolkiBonusSplit,
    refusalReasonRefPolki,
    setRefusalReasonRefPolki,
    polkiTradeDirection,
    setPolkiTradeDirection,
    polkiSkidkaType,
    setPolkiSkidkaType,
    polkiExpandedOrderId,
    setPolkiExpandedOrderId,
    polkiBonusCalcMode,
    setPolkiBonusCalcMode,
    polkiPeresortByPairKey,
    setPolkiPeresortByPairKey,
    polkiPeresortOptionsByProductId,
    clearLineMaps,
    polkiRowsAll,
    polkiLineKeySet,
    polkiReturnCategories,
    polkiRowsFiltered,
    polkiDisplayRows,
    canShowPolkiGrid,
    polkiUsesAutoBonus,
    polkiAutoBonusPreviewQ,
    polkiAutoBonusExplicitByPairKey,
    polkiAutoBonusPeresortByPairKey,
    polkiAutoBonusDebtAmount,
    polkiAutoBonusDebtByPairKey,
    polkiAutoBonusPreviewReady,
    polkiAutoBonusPreviewPending,
    polkiAutoBonusPreviewLinesByProductId,
    polkiAutoBonusPreviewError: polkiAutoBonusPreviewQ.isError,
    polkiOrderGroups,
    ...gridDerived
  };
}

