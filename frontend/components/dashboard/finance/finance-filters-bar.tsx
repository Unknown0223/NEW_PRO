"use client";

import { defaultFinanceDraft } from "@/components/dashboard/finance/date-ranges";
import { FinanceDateRangeControl } from "@/components/dashboard/finance/finance-date-range-control";
import { FinanceDateTypeFieldset } from "@/components/dashboard/finance/finance-date-type-field";
import {
  financeFilterApplyButtonClassName,
  financeFilterResetButtonClassName,
  financeFilterTriggerClassName
} from "@/components/dashboard/finance/finance-filter-styles";
import { useFinanceFilterOptions } from "@/components/dashboard/finance/finance-filter-options";
import type { FinanceFilterDraft, QuickRangeKey } from "@/components/dashboard/finance/types";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { FilterX } from "lucide-react";

export { defaultFinanceDraft };
export type { QuickRangeKey };

/**
 * Finance Dashboard filter chrome (single seam): title + date type + range + catalog filters.
 * NEW_PRO page-head duplicate qilinmaydi — period shu yerda.
 */
export function FinanceFiltersBar(props: {
  draft: FinanceFilterDraft;
  setDraft: React.Dispatch<React.SetStateAction<FinanceFilterDraft>>;
  onApply: () => void;
  onReset: () => void;
  selfSupervisorIdStr: string;
  agents: Array<{ id: number; fio: string; code?: string | null }>;
  supervisors: Array<{ id: number; fio: string; code?: string | null }>;
  clientRefs: Parameters<typeof useFinanceFilterOptions>[0]["clientRefs"];
  profileRefs: Parameters<typeof useFinanceFilterOptions>[0]["profileRefs"];
  reportFilters: Parameters<typeof useFinanceFilterOptions>[0]["reportFilters"];
  productCategories: Array<{ id: number; name: string }>;
  quickRange: QuickRangeKey;
  setQuickRange: (k: QuickRangeKey) => void;
}) {
  const {
    draft,
    setDraft,
    onApply,
    onReset,
    selfSupervisorIdStr,
    agents,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories,
    setQuickRange
  } = props;

  const opts = useFinanceFilterOptions({
    draft,
    agents,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories
  });

  return (
    <section className="relative z-40 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-600">Финансы</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Финансы</h1>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-end">
          <FinanceDateTypeFieldset
            value={draft.date_type}
            onChange={(date_type) => setDraft((p) => ({ ...p, date_type }))}
          />
          <FinanceDateRangeControl
            from={draft.from}
            to={draft.to}
            onChange={({ from, to }) => setDraft((p) => ({ ...p, from, to }))}
            onQuickRangeChange={setQuickRange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[repeat(8,minmax(0,1fr))_44px_150px]">
        <SupervisorDashboardMultiFilter
          placeholder="Супервайзер"
          searchPlaceholder="Супервайзер"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.supervisorItems}
          selectedValues={draft.supervisor_ids}
          disabled={Boolean(selfSupervisorIdStr)}
          onChange={(next) => setDraft((p) => ({ ...p, supervisor_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Агент"
          searchPlaceholder="Агент"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.agentItems}
          selectedValues={draft.agent_ids}
          onChange={(next) => setDraft((p) => ({ ...p, agent_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Зона"
          searchPlaceholder="Зона"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.zoneOptions.map((o) => ({ id: o.value, title: o.label }))}
          selectedValues={draft.territory_1_list}
          onChange={(next) =>
            setDraft((p) => ({ ...p, territory_1_list: next, territory_2_list: [], territory_3_list: [] }))
          }
        />
        <SupervisorDashboardMultiFilter
          placeholder="Область"
          searchPlaceholder="Область"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.regionOptions.map((o) => ({ id: o.value, title: o.label }))}
          selectedValues={draft.territory_2_list}
          onChange={(next) =>
            setDraft((p) => ({ ...p, territory_2_list: next, territory_3_list: [] }))
          }
        />
        <SupervisorDashboardMultiFilter
          placeholder="Город"
          searchPlaceholder="Город"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.cityOptions.map((o) => ({ id: o.value, title: o.label }))}
          selectedValues={draft.territory_3_list}
          onChange={(next) => setDraft((p) => ({ ...p, territory_3_list: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Категория клиента"
          searchPlaceholder="Категория"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.clientCategoryOptions.map((c) => ({ id: c, title: c }))}
          selectedValues={draft.client_categories}
          onChange={(next) => setDraft((p) => ({ ...p, client_categories: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Категория продукта"
          searchPlaceholder="Продукт"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.productCategoryItems}
          selectedValues={draft.category_ids}
          onChange={(next) => setDraft((p) => ({ ...p, category_ids: next }))}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Статус"
          searchPlaceholder="Статус"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.statusItems}
          selectedValues={draft.statuses}
          onChange={(next) => setDraft((p) => ({ ...p, statuses: next }))}
        />
        <button
          type="button"
          className={financeFilterResetButtonClassName}
          onClick={onReset}
          title="Сбросить"
          aria-label="Сбросить"
        >
          <FilterX className="mx-auto h-5 w-5" />
        </button>
        <button type="button" className={financeFilterApplyButtonClassName} onClick={onApply}>
          Применить
        </button>
      </div>
    </section>
  );
}
