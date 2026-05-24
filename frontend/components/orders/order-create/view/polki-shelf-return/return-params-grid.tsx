"use client";

import { useCallback } from "react";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { ReturnCategoryChips } from "./return-category-chips";
import { ReturnContextStrip } from "./return-context-strip";
import { ReturnOrderDataColumn } from "./return-order-data-column";
import { ReturnOrdersListBlock } from "./return-orders-list-block";
import { ReturnPriceTypeColumn } from "./return-price-type-column";
import { POLKI_RETURN_MODE_META } from "./polki-return-mode";

export function ReturnParamsGrid({ vm }: { vm: OrderCreateVm }) {
  const {
    mutation,
    canShowPolkiGrid,
    isPolkiByOrder,
    isPolkiFree,
    polkiReturnCategories,
    polkiContextQ,
    categoryFilterActive,
    selectedCategoryIds,
    setSelectedCategoryIds,
    setActiveCatalogCategoryId
  } = vm;

  const mode = isPolkiByOrder ? POLKI_RETURN_MODE_META.by_order : POLKI_RETURN_MODE_META.free;

  const onSelectAll = useCallback(() => {
    const list = polkiReturnCategories;
    if (!list?.length) return;
    const allSelected = selectedCategoryIds.length === list.length;
    if (allSelected) {
      setSelectedCategoryIds([]);
      setActiveCatalogCategoryId(null);
    } else {
      const ids = list.map((c) => c.id);
      setSelectedCategoryIds(ids);
      setActiveCatalogCategoryId(ids[0] ?? null);
    }
  }, [
    polkiReturnCategories,
    selectedCategoryIds.length,
    setSelectedCategoryIds,
    setActiveCatalogCategoryId
  ]);

  const onToggleCategory = useCallback(
    (id: number) => {
      setSelectedCategoryIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        if (next.length > 0) {
          setActiveCatalogCategoryId((cur) =>
            cur != null && next.includes(cur) ? cur : next[0]!
          );
        } else {
          setActiveCatalogCategoryId(null);
        }
        return next;
      });
    },
    [setSelectedCategoryIds, setActiveCatalogCategoryId]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-3">
          <ReturnOrderDataColumn vm={vm} />
        </div>
        <div className={isPolkiFree ? "xl:col-span-6" : "xl:col-span-5"}>
          <ReturnCategoryChips
            canShowPolkiGrid={canShowPolkiGrid}
            categories={polkiReturnCategories}
            contextLoading={polkiContextQ.isLoading}
            contextSuccess={polkiContextQ.isSuccess}
            contextEmpty={polkiContextQ.isSuccess && (polkiReturnCategories?.length ?? 0) === 0}
            categoryFilterActive={categoryFilterActive}
            selectedCategoryIds={selectedCategoryIds}
            disabled={mutation.isPending}
            onSelectAll={onSelectAll}
            onToggleCategory={onToggleCategory}
          />
        </div>
        <div
          className={
            isPolkiFree ? "xl:col-span-3" : "flex flex-col gap-4 xl:col-span-4"
          }
        >
          <ReturnPriceTypeColumn vm={vm} />
          {mode.showOrdersList ? <ReturnOrdersListBlock vm={vm} mode={mode} /> : null}
        </div>
      </div>

      <ReturnContextStrip vm={vm} />
    </div>
  );
}
