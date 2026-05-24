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

/** Shablon: `FinanceFiltersPanel` — sarlavha + sana, keyin 6 filter va 2 tugma. */
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
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-600">Finance module</p>
          <h2 className="text-xl font-bold text-slate-950">Финансы</h2>
        </div>
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_44px_160px]">
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
          placeholder="Территория"
          searchPlaceholder="Зона"
          triggerClassName={financeFilterTriggerClassName}
          items={opts.zoneOptions.map((o) => ({ id: o.value, title: o.label }))}
          selectedValues={draft.territory_1_list}
          onChange={(next) =>
            setDraft((p) => ({ ...p, territory_1_list: next, territory_2_list: [], territory_3_list: [] }))
          }
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
