"use client";

import { type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRODUCT_UNIT_CUSTOM } from "@/lib/product-units";
import {
  GridMultiSelect,
  GridNumberInput,
  GridSelectInput,
  GridSwitch,
  GridTextInput,
  GridUnitSelect,
  LabelCell,
  VolumeInputs
} from "../product-create/product-create-grid-ui";
import { ProductBulkApplyPanel } from "./product-bulk-create-apply-panel";
import type {
  BulkApplyState,
  BulkProductMasterData,
  BulkProductRow
} from "./product-bulk-create-types";

type Props = {
  backHref: string;
  masterData: BulkProductMasterData;
  loadingMasterData: boolean;
  rows: BulkProductRow[];
  selected: boolean[];
  bulkApply: BulkApplyState;
  rowErrors: Record<number, string>;
  saving: boolean;
  message: { type: "success" | "error"; text: string } | null;
  onBulkApplyChange: (value: BulkApplyState) => void;
  onApplyCategory: () => void;
  onApplyUnit: () => void;
  onApplyGroup: () => void;
  onApplyBrand: () => void;
  onApplyTradeDirections: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (index: number, checked: boolean) => void;
  onUpdateRow: (id: string, patch: Partial<BulkProductRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ProductBulkCreateGrid({
  backHref,
  masterData,
  loadingMasterData,
  rows,
  selected,
  bulkApply,
  rowErrors,
  saving,
  message,
  onBulkApplyChange,
  onApplyCategory,
  onApplyUnit,
  onApplyGroup,
  onApplyBrand,
  onApplyTradeDirections,
  onToggleAll,
  onToggleRow,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onSubmit
}: Props) {
  const allChecked = rows.length > 0 && selected.length === rows.length && selected.every(Boolean);

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-white shadow-sm">
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-xs text-slate-400">Настройки / Продукты</p>
              <h1 className="text-2xl font-semibold text-slate-950">Добавление нескольких товаров</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddRow}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#07958f] bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-[#f0fbfb]"
          >
            <Plus className="h-4 w-4" />
            Добавить строку
          </button>
        </div>

        {message ? (
          <div
            className={cn(
              "mx-4 mb-3 rounded-lg px-4 py-3 text-sm",
              message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            {message.text}
          </div>
        ) : null}

        {loadingMasterData ? (
          <div className="mx-4 mb-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Справочники загружаются...
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-auto border-t border-slate-100">
          <div className="flex min-w-max">
            <ProductBulkApplyPanel
              masterData={masterData}
              bulkApply={bulkApply}
              allChecked={allChecked}
              onBulkApplyChange={onBulkApplyChange}
              onToggleAll={onToggleAll}
              onApplyCategory={onApplyCategory}
              onApplyUnit={onApplyUnit}
              onApplyGroup={onApplyGroup}
              onApplyBrand={onApplyBrand}
              onApplyTradeDirections={onApplyTradeDirections}
            />

            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full min-w-[1480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white">
                    <th className="sticky left-0 z-10 w-10 bg-white px-2 py-2" />
                    <th className="w-10 px-2 py-2 text-left text-xs font-medium text-slate-500">№</th>
                    {[
                      "Категория *",
                      "Название *",
                      "Название товар",
                      "Единицы измерения *",
                      "Объем (см)",
                      "Кол-во в блоке",
                      "Код",
                      "Штрих-код",
                      "ТН ВЭД",
                      "Группа",
                      "Бренд",
                      "Направление торговли",
                      "Статус",
                      ""
                    ].map((label) => (
                      <th key={label} className="min-w-[140px] px-2 py-2 align-bottom">
                        {label ? <LabelCell>{label}</LabelCell> : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="sticky left-0 z-10 bg-white px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[#07958f]"
                          checked={selected[index] ?? false}
                          onChange={(event) => onToggleRow(index, event.target.checked)}
                          aria-label={`Строка ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2">
                        <GridSelectInput
                          value={row.categoryId}
                          onChange={(value) => onUpdateRow(row.id, { categoryId: value })}
                          options={masterData.categories}
                          placeholder="Выберите"
                          error={rowErrors[index]?.includes("категория") ? "*" : undefined}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridTextInput
                          value={row.name}
                          onChange={(value) => onUpdateRow(row.id, { name: value })}
                          placeholder="Название товара"
                          error={rowErrors[index]}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridTextInput
                          value={row.productTitle}
                          onChange={(value) => onUpdateRow(row.id, { productTitle: value })}
                          placeholder="Название товар"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridUnitSelect
                          value={row.unit}
                          custom={row.unitCustom}
                          onChange={(value) =>
                            onUpdateRow(row.id, {
                              unit: value,
                              unitCustom: value === PRODUCT_UNIT_CUSTOM ? row.unitCustom : ""
                            })
                          }
                          onCustomChange={(value) => onUpdateRow(row.id, { unitCustom: value })}
                          error={rowErrors[index]?.includes("единица") ? "*" : undefined}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <VolumeInputs
                          width={row.width}
                          height={row.height}
                          length={row.length}
                          onWidth={(value) => onUpdateRow(row.id, { width: value })}
                          onHeight={(value) => onUpdateRow(row.id, { height: value })}
                          onLength={(value) => onUpdateRow(row.id, { length: value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridNumberInput
                          value={row.blockQuantity}
                          onChange={(value) => onUpdateRow(row.id, { blockQuantity: value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridTextInput
                          value={row.code}
                          onChange={(value) => onUpdateRow(row.id, { code: value.slice(0, 20) })}
                          maxLength={20}
                          suffix={`${row.code.length}/20`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridTextInput
                          value={row.barcode}
                          onChange={(value) => onUpdateRow(row.id, { barcode: value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridTextInput
                          value={row.tnVed}
                          onChange={(value) => onUpdateRow(row.id, { tnVed: value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridSelectInput
                          value={row.groupId}
                          onChange={(value) => onUpdateRow(row.id, { groupId: value })}
                          options={masterData.groups}
                          placeholder="Выберите"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridSelectInput
                          value={row.brandId}
                          onChange={(value) => onUpdateRow(row.id, { brandId: value })}
                          options={masterData.brands}
                          placeholder="Выберите"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <GridMultiSelect
                          value={row.tradeDirectionIds}
                          onChange={(value) => onUpdateRow(row.id, { tradeDirectionIds: value })}
                          options={masterData.tradeDirections}
                          placeholder="Выберите"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-10 items-center">
                          <GridSwitch
                            checked={row.status}
                            onChange={(value) => onUpdateRow(row.id, { status: value })}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onRemoveRow(row.id)}
                          disabled={rows.length === 1}
                          className="grid h-9 w-9 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-200"
                          title="Удалить строку"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t border-slate-100 bg-white px-4 py-3">
          <Link
            href={backHref}
            className="h-10 rounded-lg bg-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-300"
          >
            Отменить
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[#07958f] px-5 text-sm font-semibold text-white transition hover:bg-[#057a76] disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </section>
  );
}
