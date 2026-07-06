"use client";

import { memo, useCallback, useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  polkiCard,
  polkiChipActive,
  polkiChipBase,
  polkiChipCheck
} from "./polki-return-ui";

type Cat = { id: number; name: string };

const CategoryChip = memo(function CategoryChip({
  id,
  name,
  active,
  disabled,
  onToggle
}: {
  id: number;
  name: string;
  active: boolean;
  disabled: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <button
      type="button"
      title={name}
      disabled={disabled}
      onClick={() => onToggle(id)}
      className={cn(polkiChipBase, active && polkiChipActive)}
    >
      {active ? (
        <span className={polkiChipCheck} aria-hidden>
          <Check className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      ) : null}
      <span className="truncate">{name}</span>
    </button>
  );
});

export const ReturnCategoryChips = memo(function ReturnCategoryChips({
  canShowPolkiGrid,
  categories,
  contextLoading,
  contextEmpty,
  selectedCategoryIds,
  disabled,
  onSelectAll,
  onToggleCategory
}: {
  canShowPolkiGrid: boolean;
  categories: Cat[] | null | undefined;
  contextLoading: boolean;
  contextEmpty: boolean;
  selectedCategoryIds: number[];
  disabled: boolean;
  onSelectAll: () => void;
  onToggleCategory: (id: number) => void;
}) {
  const selectedSet = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);
  const allExplicit =
    categories != null && categories.length > 0 && selectedCategoryIds.length === categories.length;

  const handleToggle = useCallback(
    (id: number) => onToggleCategory(id),
    [onToggleCategory]
  );

  let body: React.ReactNode;
  if (!canShowPolkiGrid) {
    body = <p className="text-xs text-slate-500">Сначала выберите клиента и склад возврата.</p>;
  } else if (contextLoading || categories == null) {
    body = <p className="text-xs text-slate-500">Загрузка продаж для возврата…</p>;
  } else if (contextEmpty) {
    body = (
      <p className="text-xs text-amber-800">
        Нет доставленных продаж для возврата у этого клиента. Оформите и доставьте заказ, затем
        обновите страницу.
      </p>
    );
  } else if (categories.length === 0) {
    body = <p className="text-xs text-slate-500">Нет категорий в продажах для возврата.</p>;
  } else {
    body = (
      <div className="flex max-h-[min(280px,40vh)] flex-wrap gap-2.5 overflow-y-auto overscroll-contain pr-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onSelectAll}
          className={cn(polkiChipBase, allExplicit && polkiChipActive)}
        >
          {allExplicit ? (
            <span className={polkiChipCheck} aria-hidden>
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </span>
          ) : null}
          Выбрать все
        </button>
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            id={c.id}
            name={c.name}
            active={selectedSet.has(c.id)}
            disabled={disabled}
            onToggle={handleToggle}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(polkiCard, !canShowPolkiGrid && "opacity-60")}>
      <h2 className="mb-3 text-[15px] font-semibold text-slate-800">Категории товаров</h2>
      {body}
    </div>
  );
});
