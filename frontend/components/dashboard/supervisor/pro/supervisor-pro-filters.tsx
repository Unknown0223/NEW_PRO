"use client";

import { SupervisorDashboardMultiFilter } from "@/components/dashboard/supervisor-dashboard-multi-filter";
import type { SupervisorDashboardQueryInput } from "@/lib/dashboard-supervisor-query";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

type Opt = { id: string; title: string; searchText?: string | null };

const MULTI_TRIGGER = "sv-multi-trigger";

export function SupervisorProFiltersBar({
  draft,
  applied,
  dateSlot,
  paymentOptions,
  agentOptions,
  supervisorOptions,
  directionOptions,
  categoryOptions,
  zoneOptions,
  regionOptions,
  cityOptions,
  onDraftChange,
  onApply,
  onReset
}: {
  draft: SupervisorDashboardQueryInput;
  applied: SupervisorDashboardQueryInput;
  dateSlot: ReactNode;
  paymentOptions: Opt[];
  agentOptions: Opt[];
  supervisorOptions: Opt[];
  directionOptions: Opt[];
  categoryOptions: Opt[];
  zoneOptions: Opt[];
  regionOptions: Opt[];
  cityOptions: Opt[];
  onDraftChange: (patch: Partial<SupervisorDashboardQueryInput>) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const appliedCount = [
    applied.payment_types,
    applied.agent_ids,
    applied.supervisor_ids,
    applied.trade_directions,
    applied.client_categories,
    applied.territory_1_list,
    applied.territory_2_list,
    applied.territory_3_list
  ].filter((x) => x.length > 0).length;

  return (
    <div className="panel sv-filters">
      <div className="sv-filters-header">
        <div>
          <b>Фильтры аналитики</b>
          <span>Выберите значения и нажмите «Применить»</span>
        </div>
        <span>{appliedCount ? `${appliedCount} применено` : "Все данные"}</span>
      </div>
      <div className="sv-filter-fields">
        <div className="sv-filter">
          <span>Дата</span>
          {dateSlot}
        </div>
        <div className="sv-filter">
          <span>Способ оплаты</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все способы"
            searchPlaceholder="Способ"
            items={paymentOptions}
            selectedValues={draft.payment_types}
            onChange={(next) => onDraftChange({ payment_types: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Агент</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все агенты"
            searchPlaceholder="Агент"
            items={agentOptions}
            selectedValues={draft.agent_ids}
            onChange={(next) => onDraftChange({ agent_ids: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Супервайзер</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все супервайзеры"
            searchPlaceholder="Супервайзер"
            items={supervisorOptions}
            selectedValues={draft.supervisor_ids}
            onChange={(next) => onDraftChange({ supervisor_ids: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Направление</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все направления"
            searchPlaceholder="Направление"
            items={directionOptions}
            selectedValues={draft.trade_directions}
            onChange={(next) => onDraftChange({ trade_directions: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Категория</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все категории"
            searchPlaceholder="Категория"
            items={categoryOptions}
            selectedValues={draft.client_categories}
            onChange={(next) => onDraftChange({ client_categories: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Зона</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все зоны"
            searchPlaceholder="Зона"
            items={zoneOptions}
            selectedValues={draft.territory_1_list}
            onChange={(next) =>
              onDraftChange({ territory_1_list: next, territory_2_list: [], territory_3_list: [] })
            }
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Область</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все области"
            searchPlaceholder="Область"
            items={regionOptions}
            selectedValues={draft.territory_2_list}
            onChange={(next) => onDraftChange({ territory_2_list: next, territory_3_list: [] })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
        <div className="sv-filter">
          <span>Город</span>
          <SupervisorDashboardMultiFilter
            placeholder="Все города"
            searchPlaceholder="Город"
            items={cityOptions}
            selectedValues={draft.territory_3_list}
            onChange={(next) => onDraftChange({ territory_3_list: next })}
            triggerClassName={MULTI_TRIGGER}
          />
        </div>
      </div>
      <div className="sv-filters-actions">
        <button type="button" className="secondary-button" onClick={onReset}>
          <RotateCcw size={14} />
          Сброс
        </button>
        <button type="button" className="primary-button" onClick={onApply}>
          Применить
        </button>
      </div>
    </div>
  );
}
