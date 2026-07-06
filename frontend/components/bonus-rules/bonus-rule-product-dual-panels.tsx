"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  BonusRuleProductCategoryTree,
  fetchAllActiveProductsPage
} from "@/components/bonus-rules/bonus-rule-product-category-tree";
import { BonusRuleTemplateCheckbox } from "@/components/bonus-rules/bonus-rule-form-fields";
import { STALE } from "@/lib/query-stale";

function ProductTreeColumn({
  title,
  tenantSlug,
  selectedIds,
  onSelectedIdsChange,
  onlyByCategory,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  formDisabled,
  selectionDisabled,
  selectionHint,
  querySuffix,
  stackClassName,
  showSelectAll,
  allSelected,
  someSelected,
  onSelectAll,
  lockedView = false
}: {
  title: string;
  tenantSlug: string;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  onlyByCategory?: boolean;
  selectedCategoryIds?: number[];
  onSelectedCategoryIdsChange?: (ids: number[]) => void;
  formDisabled: boolean;
  selectionDisabled: boolean;
  selectionHint?: string;
  querySuffix: string;
  stackClassName?: string;
  showSelectAll?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
  onSelectAll?: (checked: boolean) => void;
  lockedView?: boolean;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  return (
    <div className={cn("min-w-0", stackClassName ?? "z-0", formDisabled && !lockedView && "opacity-70")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
        {showSelectAll && onSelectAll ? (
          <BonusRuleTemplateCheckbox
            checked={Boolean(allSelected)}
            muted={!allSelected && !someSelected}
            disabled={formDisabled || selectionDisabled}
            onChange={onSelectAll}
            label="Выбрать все"
          />
        ) : null}
      </div>
      <div
        className={cn(
          "relative flex min-h-[20rem] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        )}
      >
      <div className="flex h-12 items-center gap-3 border-b border-border px-4 text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          placeholder="Поиск… (название или SKU)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={formDisabled}
          aria-label={`Поиск: ${title}`}
        />
      </div>
      {selectionHint ? (
        <p className="border-b border-border/70 px-4 py-2 text-xs leading-snug text-amber-800 dark:text-amber-200/95">
          {selectionHint}
        </p>
      ) : null}
      <div className="relative min-h-[14rem] max-h-[min(24rem,45vh)] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className="pointer-events-none absolute right-1 top-2 bottom-2 w-1 rounded-full bg-teal-600/80" aria-hidden />
        <BonusRuleProductCategoryTree
          tenantSlug={tenantSlug}
          value={selectedIds}
          onChange={onSelectedIdsChange}
          categoryScopeIds={onlyByCategory ? selectedCategoryIds : undefined}
          onCategoryScopeChange={onlyByCategory ? onSelectedCategoryIdsChange : undefined}
          disabled={formDisabled && !lockedView}
          selectionDisabled={selectionDisabled}
          search={deferredSearch}
          querySuffix={querySuffix}
          restrictToSelection={lockedView}
          allowExpandWhenDisabled={lockedView}
        />
      </div>
      <div className="border-t border-border/80 px-3 py-1.5 text-[11px] text-muted-foreground">
        Выбрано: {selectedIds.length}
        {selectionDisabled ? (
          <span className="ml-1 text-amber-800/90 dark:text-amber-200/80">(не сохраняется)</span>
        ) : null}
      </div>
      </div>
    </div>
  );
}

export type BonusRuleProductDualPanelsProps = {
  tenantSlug: string;
  triggerProductIds: number[];
  bonusProductIds: number[];
  onTriggerChange: (ids: number[]) => void;
  onBonusChange: (ids: number[]) => void;
  onlyByAssortment: boolean;
  /** true bo‘lsa trigger SKU lar o‘rniga faqat kategoriya filtri */
  onlyByCategory?: boolean;
  selectedCategoryIds?: number[];
  onSelectedCategoryIdsChange?: (ids: number[]) => void;
  showTriggerColumn: boolean;
  showBonusColumn: boolean;
  disabled?: boolean;
  /** Qoida qulflangan — faqat tanlangan kategoriya/mahsulotlar, ochish mumkin */
  lockedView?: boolean;
};

/**
 * Ikki ustun: chap — trigger mahsulotlar, o‘ng — bonus mahsulotlar.
 * Faol mahsulotlar kategoriya bo‘yicha ochiladi-yopiladi; qatorlarda checkbox.
 */
export function BonusRuleProductDualPanels({
  tenantSlug,
  triggerProductIds,
  bonusProductIds,
  onTriggerChange,
  onBonusChange,
  onlyByAssortment,
  onlyByCategory = false,
  selectedCategoryIds = [],
  onSelectedCategoryIdsChange,
  showTriggerColumn,
  showBonusColumn,
  disabled = false,
  lockedView = false
}: BonusRuleProductDualPanelsProps) {
  const formDisabled = Boolean(disabled);
  const triggerPickEnabled = onlyByAssortment || onlyByCategory;

  const allProductsQ = useQuery({
    queryKey: ["bonus-rule-all-products", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams({ is_active: "true" });
      return fetchAllActiveProductsPage(tenantSlug, p);
    }
  });

  const allProductIds = useMemo(() => (allProductsQ.data ?? []).map((p) => p.id), [allProductsQ.data]);

  const bonusAllSelected =
    allProductIds.length > 0 && allProductIds.every((id) => bonusProductIds.includes(id));
  const bonusSomeSelected =
    allProductIds.some((id) => bonusProductIds.includes(id)) && !bonusAllSelected;

  const toggleAllProducts = (ids: number[], onChange: (next: number[]) => void, checked: boolean) => {
    if (!checked) {
      onChange([]);
      return;
    }
    onChange([...ids].sort((a, b) => a - b));
  };

  return (
    <div
      className={cn(
        "grid min-w-0 items-start gap-4",
        showTriggerColumn && showBonusColumn ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
      )}
    >
      {showTriggerColumn ? (
        <ProductTreeColumn
          title="Товар (триггер)"
          tenantSlug={tenantSlug}
          selectedIds={triggerProductIds}
          onSelectedIdsChange={onTriggerChange}
          onlyByCategory={onlyByCategory}
          selectedCategoryIds={selectedCategoryIds}
          onSelectedCategoryIdsChange={onSelectedCategoryIdsChange}
          formDisabled={formDisabled}
          selectionDisabled={!triggerPickEnabled || lockedView}
          selectionHint={
            lockedView
              ? "Правило заблокировано — только выбранные категории и товары. Нажмите ▶, чтобы развернуть список."
              : onlyByCategory
              ? "Отметьте категории (флажок у названия) и при необходимости отдельные SKU слева."
              : !onlyByAssortment
                ? "Оба ограничения выключены — триггером считаются все товары. Включите «Только ассортимент» или «Категория», чтобы ограничить по SKU/категории."
                : undefined
          }
          querySuffix="dual-trigger"
          lockedView={lockedView}
        />
      ) : null}
      {showBonusColumn ? (
        <ProductTreeColumn
          title="Бонус-товары"
          tenantSlug={tenantSlug}
          selectedIds={bonusProductIds}
          onSelectedIdsChange={onBonusChange}
          formDisabled={formDisabled}
          selectionDisabled={lockedView}
          querySuffix="dual-bonus"
          lockedView={lockedView}
          showSelectAll
          allSelected={bonusAllSelected}
          someSelected={bonusSomeSelected}
          onSelectAll={(checked) => toggleAllProducts(allProductIds, onBonusChange, checked)}
        />
      ) : null}
    </div>
  );
}
