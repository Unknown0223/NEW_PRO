"use client";

import { defaultSalesDraft } from "@/components/dashboard/sales/date-ranges";
import { SalesDateTypeFieldset } from "@/components/dashboard/sales/sales-date-type-field";
import { useSalesFilterOptions } from "@/components/dashboard/sales/sales-filter-options";
import type { QuickRangeKey, SalesFilterDraft } from "@/components/dashboard/sales/types";
import { formatPaymentTypeLabel } from "@/components/dashboard/sales/format";
import { DashboardDateRangeControl } from "@/components/dashboard/shared/dashboard-date-range-control";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { ChevronDown, FilterX } from "lucide-react";
import { useMemo, useState } from "react";

export { defaultSalesDraft };
export type { QuickRangeKey };

export function SalesFiltersBar(props: {
  draft: SalesFilterDraft;
  setDraft: React.Dispatch<React.SetStateAction<SalesFilterDraft>>;
  onApply: () => void;
  onReset: () => void;
  selfSupervisorIdStr: string;
  supervisors: Array<{ id: number; fio: string; code?: string | null }>;
  clientRefs: Parameters<typeof useSalesFilterOptions>[0]["clientRefs"];
  profileRefs: Parameters<typeof useSalesFilterOptions>[0]["profileRefs"];
  reportFilters: Parameters<typeof useSalesFilterOptions>[0]["reportFilters"];
  productCategories: Array<{ id: number; name: string }>;
  catalogManufacturers: Array<{ id: number; name: string }>;
  catalogGroups: Array<{ id: number; name: string }>;
  catalogBrands: Array<{ id: number; name: string }>;
  quickRange: QuickRangeKey;
  setQuickRange: (k: QuickRangeKey) => void;
  exportAction?: React.ReactNode;
}) {
  const {
    draft,
    setDraft,
    onApply,
    onReset,
    selfSupervisorIdStr,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories,
    catalogManufacturers,
    catalogGroups,
    catalogBrands,
    quickRange,
    setQuickRange,
    exportAction
  } = props;

  const [moreOpen, setMoreOpen] = useState(false);
  const opts = useSalesFilterOptions({
    draft,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories,
    catalogManufacturers,
    catalogGroups,
    catalogBrands
  });

  const paymentFilterLabel = useMemo(() => {
    if (draft.payment_types.length === 0) return null;
    return draft.payment_types
      .map((id) => {
        const o = opts.paymentOptions.find((p) => p.value === id);
        return formatPaymentTypeLabel(o?.label ?? id);
      })
      .join(", ");
  }, [draft.payment_types, opts.paymentOptions]);

  const selectCls = cn(filterPanelSelectClassName, "h-12 min-w-0 text-xs");

  return (
    <section className="sales-dashboard-panel sales-motion-slide-up">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-600">Sales module</p>
          <h2 className="text-xl font-bold text-slate-950">Продажи</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Аналитика продаж: покрытие, структура оплат, территории и эффективность агентов.
          </p>
          {paymentFilterLabel ? (
            <p className="mt-1 text-xs text-teal-700">
              Способ оплаты: <span className="font-semibold">{paymentFilterLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
          <SalesDateTypeFieldset
            value={draft.date_type}
            onChange={(date_type) => setDraft((p) => ({ ...p, date_type }))}
          />
          <DashboardDateRangeControl
            from={draft.from}
            to={draft.to}
            onChange={({ from, to }) => setDraft((p) => ({ ...p, from, to }))}
            onQuickRangeChange={setQuickRange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_44px_minmax(120px,1fr)]">
        <SupervisorDashboardMultiFilter
          placeholder="Супервайзер"
          searchPlaceholder="Супервайзер"
          triggerClassName={selectCls}
          items={opts.supervisorItems}
          selectedValues={draft.supervisor_ids}
          disabled={Boolean(selfSupervisorIdStr)}
          onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Статус"
          searchPlaceholder="Статус"
          triggerClassName={selectCls}
          items={opts.statusItems}
          selectedValues={draft.status}
          onChange={(next) => setDraft((p) => ({ ...p, status: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Категория товара"
          searchPlaceholder="Категория"
          triggerClassName={selectCls}
          items={opts.productCategoryItems}
          selectedValues={draft.category_ids}
          onChange={(next) => setDraft((p) => ({ ...p, category_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Производитель"
          searchPlaceholder="Производитель"
          triggerClassName={selectCls}
          items={opts.manufacturerItems}
          selectedValues={draft.manufacturer_ids}
          onChange={(next) => setDraft((p) => ({ ...p, manufacturer_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Группы товаров"
          searchPlaceholder="Группа"
          triggerClassName={selectCls}
          items={opts.groupItems}
          selectedValues={draft.group_ids}
          onChange={(next) => setDraft((p) => ({ ...p, group_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Способ оплаты"
          searchPlaceholder="Оплата"
          triggerClassName={selectCls}
          items={opts.paymentOptions.map((o) => ({
            id: o.value,
            title: formatPaymentTypeLabel(o.label)
          }))}
          selectedValues={draft.payment_types}
          onChange={(next) => setDraft((p) => ({ ...p, payment_types: next }))}
        />
        <button
          type="button"
          className="h-12 rounded-xl bg-teal-500/50 px-3 text-sm font-bold text-white transition hover:bg-teal-600"
          onClick={onReset}
          title="Сбросить"
          aria-label="Сбросить"
        >
          <FilterX className="mx-auto h-5 w-5" />
        </button>
        <div className="flex h-12 gap-2">
          {exportAction}
          <button
            type="button"
            className="h-12 flex-1 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
            onClick={onApply}
          >
            Применить
          </button>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-700"
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? "Скрыть доп. фильтры" : "Бренд, направление, территория"}
        <ChevronDown className={cn("h-4 w-4 transition", moreOpen && "rotate-180")} />
      </button>
      {moreOpen ? (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <SupervisorDashboardMultiFilter
            placeholder="Бренды"
            searchPlaceholder="Бренд"
            triggerClassName={selectCls}
            items={opts.brandItems}
            selectedValues={draft.brand_ids}
            onChange={(next) => setDraft((p) => ({ ...p, brand_ids: next }))}
          />
          <SupervisorDashboardMultiFilter
            placeholder="Направление"
            searchPlaceholder="Направление"
            triggerClassName={selectCls}
            items={opts.tradeOptions.map((o) => ({ id: o.value, title: o.label }))}
            selectedValues={draft.trade_directions}
            onChange={(next) => setDraft((p) => ({ ...p, trade_directions: next }))}
          />
          <SupervisorDashboardMultiFilter
            placeholder="Территория"
            searchPlaceholder="Зона"
            triggerClassName={selectCls}
            items={opts.zoneOptions.map((o) => ({ id: o.value, title: o.label }))}
            selectedValues={draft.territory_1_list}
            onChange={(next) =>
              setDraft((p) => ({ ...p, territory_1_list: next, territory_2_list: [], territory_3_list: [] }))
            }
          />
          <SupervisorDashboardMultiFilter
            placeholder="Область"
            searchPlaceholder="Область"
            triggerClassName={selectCls}
            items={opts.regionOptions.map((o) => ({ id: o.value, title: o.label }))}
            selectedValues={draft.territory_2_list}
            onChange={(next) => setDraft((p) => ({ ...p, territory_2_list: next, territory_3_list: [] }))}
          />
          <SupervisorDashboardMultiFilter
            placeholder="Город"
            searchPlaceholder="Город"
            triggerClassName={selectCls}
            items={opts.cityOptions.map((o) => ({ id: o.value, title: o.label }))}
            selectedValues={draft.territory_3_list}
            onChange={(next) => setDraft((p) => ({ ...p, territory_3_list: next }))}
          />
        </div>
      ) : null}
    </section>
  );
}
