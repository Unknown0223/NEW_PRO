"use client";

import { addCalendarMonths, formatMonthYearRu, monthYearFromEndMinusDays } from "@/components/dashboard/monitoring/utils";
import type { MonitoringDraft } from "@/components/dashboard/monitoring/types";
import { MonitoringSectionSettingsFilter } from "@/components/dashboard/monitoring/monitoring-section-settings";
import { MonitoringTerritoryTreeFilter } from "@/components/dashboard/monitoring/monitoring-territory-tree-filter";
import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import { financeFilterApplyButtonClassName } from "@/components/dashboard/finance/finance-filter-styles";
import { Button } from "@/components/ui/button";
import {
  MonthYearPickerPopover,
  parseYearMonthYm,
  toYearMonthString
} from "@/components/ui/month-year-picker-popover";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { MonitoringSectionId } from "@/components/dashboard/monitoring/monitoring-section-config";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

export { defaultMonitoringDraft } from "@/components/dashboard/monitoring/utils";

const selectCls =
  "flex h-9 min-w-0 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-none outline-none transition hover:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-500/30";

export const MonitoringFiltersBar = memo(function MonitoringFiltersBar(props: {
  appliedDraft: MonitoringDraft;
  onApply: (draft: MonitoringDraft) => void;
  selfSupervisorIdStr: string;
  territoryNodes: TerritoryNode[];
  branchOptions: Array<{ value: string; label: string }>;
  agentOptions: Array<{ id: string; title: string }>;
  supervisorOptions: Array<{ id: string; title: string }>;
  visibleSectionIds: Set<MonitoringSectionId>;
  onVisibleSectionsChange: (next: Set<MonitoringSectionId>) => void;
}) {
  const {
    appliedDraft,
    onApply,
    selfSupervisorIdStr,
    territoryNodes,
    branchOptions,
    agentOptions,
    supervisorOptions,
    visibleSectionIds,
    onVisibleSectionsChange
  } = props;

  const [draft, setDraft] = useState(appliedDraft);
  useEffect(() => {
    setDraft(appliedDraft);
  }, [appliedDraft]);

  const branchItems = useMemo(
    () => branchOptions.map((o) => ({ id: o.value, title: o.label })),
    [branchOptions]
  );

  const periodAnchorRef = useRef<HTMLButtonElement>(null);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);

  const shiftMonth = useCallback((delta: number) => {
    setDraft((p) => ({ ...p, ...addCalendarMonths(p.year, p.month, delta) }));
  }, []);

  const handleApply = useCallback(() => onApply(draft), [draft, onApply]);

  const onBranchChange = useCallback((next: string[]) => {
    setDraft((p) => ({ ...p, branch_codes: next }));
  }, []);

  const onTerritoryChange = useCallback((next: string[]) => {
    setDraft((p) => ({
      ...p,
      territory_tree_node_ids: next,
      territory_ids: [],
      territory_1_list: [],
      territory_2_list: [],
      territory_3_list: []
    }));
  }, []);

  const onAgentChange = useCallback((next: string[]) => {
    setDraft((p) => ({ ...p, agent_ids: next }));
  }, []);

  const onSupervisorChange = useCallback((next: string[]) => {
    setDraft((p) => ({ ...p, supervisor_ids: next }));
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl bg-white p-0 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="shrink-0 text-[17px] font-semibold text-slate-900">Мониторинг продаж и планов</h2>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="hidden min-w-[200px] sm:block md:min-w-[240px] lg:min-w-[280px]">
            <MonitoringSectionSettingsFilter
              visibleSectionIds={visibleSectionIds}
              onVisibleChange={onVisibleSectionsChange}
              triggerClassName={selectCls}
            />
          </div>

          <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center border-r border-slate-200 hover:bg-slate-50"
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <button
              ref={periodAnchorRef}
              type="button"
              className="flex h-9 min-w-[8.75rem] items-center justify-center gap-1.5 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 sm:min-w-[10rem]"
              onClick={() => setPeriodPickerOpen((o) => !o)}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 text-teal-600" />
              <span className="truncate tabular-nums">{formatMonthYearRu(draft.month, draft.year)}</span>
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center border-l border-slate-200 hover:bg-slate-50"
              onClick={() => shiftMonth(1)}
              aria-label="Следующий месяц"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          <MonthYearPickerPopover
            open={periodPickerOpen}
            onOpenChange={setPeriodPickerOpen}
            anchorRef={periodAnchorRef}
            value={toYearMonthString(draft.year, draft.month - 1)}
            onChange={(ym) => {
              const parsed = parseYearMonthYm(ym);
              if (parsed) setDraft((p) => ({ ...p, year: parsed.y, month: parsed.m + 1 }));
            }}
            extraPresets={
              <>
                <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setDraft((p) => ({ ...p, ...addCalendarMonths(p.year, p.month, -1) })); setPeriodPickerOpen(false); }}>Пред.</Button>
                <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setDraft((p) => ({ ...p, year: p.year - 1 })); setPeriodPickerOpen(false); }}>−1 г.</Button>
                <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setDraft((p) => ({ ...p, ...monthYearFromEndMinusDays(7) })); setPeriodPickerOpen(false); }}>7д</Button>
                <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setDraft((p) => ({ ...p, ...monthYearFromEndMinusDays(30) })); setPeriodPickerOpen(false); }}>30д</Button>
              </>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 p-3 md:grid-cols-5">
        <SupervisorDashboardMultiFilter
          placeholder="Филиалы"
          searchPlaceholder="Филиал"
          triggerClassName={selectCls}
          items={branchItems}
          selectedValues={draft.branch_codes}
          onChange={onBranchChange}
        />
        <MonitoringTerritoryTreeFilter
          nodes={territoryNodes}
          selectedIds={draft.territory_tree_node_ids}
          onChange={onTerritoryChange}
          triggerClassName={selectCls}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Агент"
          searchPlaceholder="Агент"
          triggerClassName={selectCls}
          items={agentOptions}
          selectedValues={draft.agent_ids}
          onChange={onAgentChange}
        />
        <SupervisorDashboardMultiFilter
          placeholder="Супервайзеры"
          searchPlaceholder="Супервайзер"
          triggerClassName={selectCls}
          items={supervisorOptions}
          selectedValues={draft.supervisor_ids}
          disabled={Boolean(selfSupervisorIdStr)}
          onChange={onSupervisorChange}
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            className={financeFilterApplyButtonClassName + " h-9 md:w-auto"}
            onClick={handleApply}
          >
            Применить
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 px-3 pb-3 sm:hidden">
        <MonitoringSectionSettingsFilter
          visibleSectionIds={visibleSectionIds}
          onVisibleChange={onVisibleSectionsChange}
          triggerClassName={selectCls}
        />
      </div>
    </section>
  );
});
