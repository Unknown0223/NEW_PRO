"use client";

import {
  GridMultiSelect,
  GridSelectInput,
  GridUnitSelect
} from "../product-create/product-create-grid-ui";
import type { BulkApplyState, BulkProductMasterData } from "./product-bulk-create-types";

function ApplyButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 w-full rounded-lg border border-[#07958f]/30 bg-[#f0fbfb] px-2 text-[11px] font-semibold text-[#057a76] transition hover:bg-[#e6f5f4]"
    >
      {label}
    </button>
  );
}

type Props = {
  masterData: BulkProductMasterData;
  bulkApply: BulkApplyState;
  allChecked: boolean;
  onBulkApplyChange: (value: BulkApplyState) => void;
  onToggleAll: (checked: boolean) => void;
  onApplyCategory: () => void;
  onApplyUnit: () => void;
  onApplyGroup: () => void;
  onApplyBrand: () => void;
  onApplyTradeDirections: () => void;
};

export function ProductBulkApplyPanel({
  masterData,
  bulkApply,
  allChecked,
  onBulkApplyChange,
  onToggleAll,
  onApplyCategory,
  onApplyUnit,
  onApplyGroup,
  onApplyBrand,
  onApplyTradeDirections
}: Props) {
  return (
    <div className="flex w-[220px] min-w-[220px] flex-col gap-3 border-r border-slate-200 bg-slate-50/70 p-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <input
          type="checkbox"
          className="size-3.5 accent-[#07958f]"
          checked={allChecked}
          onChange={(event) => onToggleAll(event.target.checked)}
        />
        Выбрать все
      </label>
      <p className="text-[10px] leading-snug text-slate-500">
        Отметьте строки или оставьте пустым — значение применится ко всем строкам.
      </p>

      <div className="space-y-1.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-medium text-slate-600">Категория</p>
        <GridSelectInput
          value={bulkApply.categoryId}
          onChange={(value) => onBulkApplyChange({ ...bulkApply, categoryId: value })}
          options={masterData.categories}
          placeholder="Выберите"
        />
        <ApplyButton onClick={onApplyCategory} label="К строкам" />
      </div>

      <div className="space-y-1.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-medium text-slate-600">Единица измерения</p>
        <GridUnitSelect
          value={bulkApply.unit}
          custom={bulkApply.unitCustom}
          onChange={(value) => onBulkApplyChange({ ...bulkApply, unit: value })}
          onCustomChange={(value) => onBulkApplyChange({ ...bulkApply, unitCustom: value })}
        />
        <ApplyButton onClick={onApplyUnit} label="К строкам" />
      </div>

      <div className="space-y-1.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-medium text-slate-600">Группа продуктов</p>
        <GridSelectInput
          value={bulkApply.groupId}
          onChange={(value) => onBulkApplyChange({ ...bulkApply, groupId: value })}
          options={masterData.groups}
          placeholder="Выберите"
        />
        <ApplyButton onClick={onApplyGroup} label="К строкам" />
      </div>

      <div className="space-y-1.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-medium text-slate-600">Бренд</p>
        <GridSelectInput
          value={bulkApply.brandId}
          onChange={(value) => onBulkApplyChange({ ...bulkApply, brandId: value })}
          options={masterData.brands}
          placeholder="Выберите"
        />
        <ApplyButton onClick={onApplyBrand} label="К строкам" />
      </div>

      <div className="space-y-1.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-medium text-slate-600">Направление торговли</p>
        <GridMultiSelect
          value={bulkApply.tradeDirectionIds}
          onChange={(value) => onBulkApplyChange({ ...bulkApply, tradeDirectionIds: value })}
          options={masterData.tradeDirections}
          placeholder="Выберите"
        />
        <ApplyButton onClick={onApplyTradeDirections} label="К строкам" />
      </div>
    </div>
  );
}
