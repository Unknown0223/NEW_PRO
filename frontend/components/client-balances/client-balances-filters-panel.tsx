"use client";

import { ClientBalancesFiltersVisibilityDialog } from "@/components/client-balances/client-balances-filters-visibility-dialog";
import { FilterDateField } from "@/components/client-balances/client-balances-filter-date-field";
import {
  ClientsTemplateSelectField,
  type TemplateSelectOption
} from "@/components/clients/clients-template-select-field";
import {
  joinMultiFilterValues,
  splitMultiFilterValues
} from "@/lib/client-filter-select-value";
import {
  loadClientBalancesFilterVisibility,
  type ClientBalancesFilterVisibility
} from "@/lib/client-balances-filters-visibility";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ClientBalancesFilterForm = {
  agent_id: string;
  expeditor_user_id: string;
  supervisor_user_id: string;
  trade_direction: string;
  category: string;
  status: string;
  balance_filter: string;
  territory_zone: string;
  territory_region: string;
  territory_city: string;
  balance_date: string;
  order_date: string;
  license_from: string;
  license_to: string;
  agent_branch: string;
  agent_payment_type: string;
};

const STATUS_OPTS: TemplateSelectOption[] = [
  { value: "active", label: "Активные" },
  { value: "inactive", label: "Неактивные" }
];

const BALANCE_OPTS: TemplateSelectOption[] = [
  { value: "debt", label: "Долг" },
  { value: "credit", label: "Переплата" }
];

type FilterRowItem = {
  id: string;
  visibilityKey: keyof ClientBalancesFilterVisibility;
  label: string;
  options: TemplateSelectOption[];
  values: string[];
  onChange: (v: string[]) => void;
};

type Props = {
  draft: ClientBalancesFilterForm;
  onDraftChange: (patch: Partial<ClientBalancesFilterForm>) => void;
  onApply: () => void;
  onReset: () => void;
  branchOptions: string[];
  agentOptions: Array<{ id: number; fio: string; code?: string | null }>;
  supervisorOptions: Array<{ id: number; fio: string }>;
  expeditorOptions: Array<{ id: number; fio: string }>;
  categoryOptions: string[];
  tradeDirectionOptions: string[];
  paymentTypeOptions: Array<{ value: string; label: string }>;
  territoryCascade: {
    zones: TemplateSelectOption[];
    regions: TemplateSelectOption[];
    cities: TemplateSelectOption[];
  };
};

export function ClientBalancesFiltersPanel({
  draft,
  onDraftChange,
  onApply,
  onReset,
  branchOptions,
  agentOptions,
  supervisorOptions,
  expeditorOptions,
  categoryOptions,
  tradeDirectionOptions,
  paymentTypeOptions,
  territoryCascade
}: Props) {
  const patch = (p: Partial<ClientBalancesFilterForm>) => onDraftChange(p);
  const [filterVis, setFilterVis] = useState<ClientBalancesFilterVisibility>(() =>
    loadClientBalancesFilterVisibility()
  );
  const [visDialogOpen, setVisDialogOpen] = useState(false);

  useEffect(() => {
    setFilterVis(loadClientBalancesFilterVisibility());
  }, []);

  const branchOpts = useMemo(
    () => branchOptions.map((b) => ({ value: b, label: b })),
    [branchOptions]
  );
  const agentOpts = useMemo(
    () =>
      agentOptions.map((a) => ({
        value: String(a.id),
        label: `${a.fio}${a.code ? ` (${a.code})` : ""}`
      })),
    [agentOptions]
  );
  const supervisorOpts = useMemo(
    () => supervisorOptions.map((s) => ({ value: String(s.id), label: s.fio })),
    [supervisorOptions]
  );
  const expeditorOpts = useMemo(
    () => expeditorOptions.map((e) => ({ value: String(e.id), label: e.fio })),
    [expeditorOptions]
  );
  const categoryOpts = useMemo(
    () => categoryOptions.map((c) => ({ value: c, label: c })),
    [categoryOptions]
  );
  const tradeOpts = useMemo(
    () => tradeDirectionOptions.map((t) => ({ value: t, label: t })),
    [tradeDirectionOptions]
  );
  const paymentOpts = useMemo(
    () => paymentTypeOptions.map((o) => ({ value: o.value, label: o.label })),
    [paymentTypeOptions]
  );

  const row1: FilterRowItem[] = [
    {
      id: "branch",
      visibilityKey: "agent_branch",
      label: "Филиалы",
      options: branchOpts,
      values: splitMultiFilterValues(draft.agent_branch),
      onChange: (v) => patch({ agent_branch: joinMultiFilterValues(v) })
    },
    {
      id: "supervisor",
      visibilityKey: "supervisor_user_id",
      label: "Супервайзер",
      options: supervisorOpts,
      values: splitMultiFilterValues(draft.supervisor_user_id),
      onChange: (v) => patch({ supervisor_user_id: joinMultiFilterValues(v) })
    },
    {
      id: "agent",
      visibilityKey: "agent_id",
      label: "Агент",
      options: agentOpts,
      values: splitMultiFilterValues(draft.agent_id),
      onChange: (v) => patch({ agent_id: joinMultiFilterValues(v) })
    },
    {
      id: "expeditor",
      visibilityKey: "expeditor_user_id",
      label: "Экспедитор",
      options: expeditorOpts,
      values: splitMultiFilterValues(draft.expeditor_user_id),
      onChange: (v) => patch({ expeditor_user_id: joinMultiFilterValues(v) })
    },
    {
      id: "category",
      visibilityKey: "category",
      label: "Категория",
      options: categoryOpts,
      values: splitMultiFilterValues(draft.category),
      onChange: (v) => patch({ category: joinMultiFilterValues(v) })
    },
    {
      id: "trade",
      visibilityKey: "trade_direction",
      label: "Направление торговли",
      options: tradeOpts,
      values: splitMultiFilterValues(draft.trade_direction),
      onChange: (v) => patch({ trade_direction: joinMultiFilterValues(v) })
    },
    {
      id: "status",
      visibilityKey: "status",
      label: "Статус",
      options: STATUS_OPTS,
      values: splitMultiFilterValues(draft.status),
      onChange: (v) => patch({ status: joinMultiFilterValues(v) })
    }
  ];

  const row2: FilterRowItem[] = [
    {
      id: "balance",
      visibilityKey: "balance_filter",
      label: "Общий баланс",
      options: BALANCE_OPTS,
      values: splitMultiFilterValues(draft.balance_filter),
      onChange: (v) => patch({ balance_filter: joinMultiFilterValues(v) })
    },
    {
      id: "payment",
      visibilityKey: "agent_payment_type",
      label: "Тип оплаты",
      options: paymentOpts,
      values: splitMultiFilterValues(draft.agent_payment_type),
      onChange: (v) => patch({ agent_payment_type: joinMultiFilterValues(v) })
    },
    {
      id: "zone",
      visibilityKey: "territory_zone",
      label: "Зона",
      options: territoryCascade.zones,
      values: splitMultiFilterValues(draft.territory_zone),
      onChange: (v) =>
        patch({
          territory_zone: joinMultiFilterValues(v),
          territory_region: "",
          territory_city: ""
        })
    },
    {
      id: "region",
      visibilityKey: "territory_region",
      label: "Область",
      options: territoryCascade.regions,
      values: splitMultiFilterValues(draft.territory_region),
      onChange: (v) =>
        patch({
          territory_region: joinMultiFilterValues(v),
          territory_city: ""
        })
    },
    {
      id: "city",
      visibilityKey: "territory_city",
      label: "Город",
      options: territoryCascade.cities,
      values: splitMultiFilterValues(draft.territory_city),
      onChange: (v) => patch({ territory_city: joinMultiFilterValues(v) })
    }
  ];

  const visibleRow1 = row1.filter((f) => filterVis[f.visibilityKey]);
  const visibleRow2 = row2.filter((f) => filterVis[f.visibilityKey]);

  const renderRow = (items: FilterRowItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        {items.map((f) => (
          <ClientsTemplateSelectField
            key={f.id}
            label={f.label}
            options={f.options}
            values={f.values}
            onChange={f.onChange}
            multi
            compact
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="w-full overflow-visible rounded-lg border border-border bg-card px-3 pb-3 pt-3 shadow-sm dark:border-border dark:bg-card sm:px-4">
        <div className="mb-2 flex min-w-0 items-end justify-between gap-3 overflow-visible">
          <h2 className="shrink-0 pb-0.5 text-lg font-bold text-gray-800 dark:text-foreground">
            Балансы клиентов
          </h2>
          <div className="flex shrink-0 flex-nowrap items-end gap-1.5 overflow-visible pb-0.5">
            {filterVis.balance_date ? (
              <FilterDateField
                compact
                label="Баланс на дату"
                value={draft.balance_date}
                onChange={(iso) => patch({ balance_date: iso })}
              />
            ) : null}
            {filterVis.license_from ? (
              <FilterDateField
                compact
                label="Дата срок консигнация · Срок от"
                value={draft.license_from}
                onChange={(iso) => patch({ license_from: iso })}
              />
            ) : null}
            {filterVis.license_to ? (
              <FilterDateField
                compact
                label="Дата срок консигнация · Срок до"
                value={draft.license_to}
                onChange={(iso) => patch({ license_to: iso })}
              />
            ) : null}
            <button
              type="button"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center self-center rounded-md border border-border bg-card text-gray-500 shadow-sm hover:bg-muted dark:border-input dark:bg-background"
              title="Настройка полей фильтра"
              aria-label="Настройка полей фильтра"
              onClick={() => setVisDialogOpen(true)}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        </div>

        {renderRow(visibleRow1)}
        <div className="grid grid-cols-2 items-center gap-1.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          {visibleRow2.map((f) => (
            <ClientsTemplateSelectField
              key={f.id}
              label={f.label}
              options={f.options}
              values={f.values}
              onChange={f.onChange}
              multi
              compact
            />
          ))}
          <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1 xl:col-span-2 xl:justify-end">
            <button
              type="button"
              title="Сбросить"
              onClick={onReset}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card transition-colors hover:bg-muted dark:border-input dark:bg-background"
            >
              <RotateCcw className="h-3.5 w-3.5 text-gray-600" />
            </button>
            <button
              type="button"
              onClick={onApply}
              className="h-8 flex-1 whitespace-nowrap rounded-md bg-emerald-500 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 xl:min-w-[8rem] xl:flex-none"
            >
              Применить
            </button>
          </div>
        </div>
      </div>

      <ClientBalancesFiltersVisibilityDialog
        open={visDialogOpen}
        onOpenChange={setVisDialogOpen}
        value={filterVis}
        onChange={setFilterVis}
      />
    </>
  );
}
