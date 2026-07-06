"use client";

import { EXECUTION_TYPE_OPTIONS } from "@/components/order-automation-rules/automation-display";
import type { OrderAutomationFilterRefs } from "@/components/order-automation-rules/use-order-automation-reference";
import { OrdersListSingleMultiFilter } from "@/components/orders/orders-list/orders-list-single-multi-filter";
import { ordersFilterRowSelect } from "@/components/orders/orders-list/orders-list-filter-ui";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { Filter, RotateCcw } from "lucide-react";
import { useMemo } from "react";

export type RestrictionFilterDraft = {
  agent_user_id: string;
  trade_direction_ref: string;
  payment_method_ref: string;
  warehouse_id: string;
  zone: string;
  region: string;
  city: string;
};

export type AutoConfirmFilterDraft = {
  execution_type: string;
  request_type_ref: string;
  agent_user_id: string;
  trade_direction_ref: string;
  payment_method_ref: string;
  warehouse_id: string;
};

function territoryItems(opts: RefSelectOption[]) {
  return opts.map((o) => ({
    id: o.value,
    title: o.label,
    searchText: [o.value, o.label].filter(Boolean).join(" ")
  }));
}

function selectItems(opts: { value: string; label: string }[]) {
  return opts.map((o) => ({ id: o.value, title: o.label }));
}

type RefProps = Pick<
  OrderAutomationFilterRefs,
  | "agents"
  | "warehouses"
  | "paymentMethodFilterOpts"
  | "tradeDirectionFilterOpts"
  | "requestTypeFilterOpts"
  | "buildTerritoryCascade"
>;

export function RestrictionFiltersBar({
  draft,
  onChange,
  onApply,
  onReset,
  refs
}: {
  draft: RestrictionFilterDraft;
  onChange: (d: RestrictionFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  refs: RefProps;
}) {
  const patch = (p: Partial<RestrictionFilterDraft>) => onChange({ ...draft, ...p });

  const territoryCascade = refs.buildTerritoryCascade({
    zone: draft.zone,
    region: draft.region,
    city: draft.city
  });
  const zoneItems = useMemo(() => territoryItems(territoryCascade.zones), [territoryCascade.zones]);
  const regionItems = useMemo(
    () => territoryItems(territoryCascade.regions),
    [territoryCascade.regions]
  );
  const cityItems = useMemo(() => territoryItems(territoryCascade.cities), [territoryCascade.cities]);

  const agentItems = useMemo(
    () => refs.agents.map((a) => ({ id: String(a.id), title: a.fio })),
    [refs.agents]
  );
  const warehouseItems = useMemo(
    () => refs.warehouses.map((w) => ({ id: String(w.id), title: w.name })),
    [refs.warehouses]
  );

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Агент"
            searchPlaceholder="Агент"
            triggerClassName={ordersFilterRowSelect}
            items={agentItems}
            value={draft.agent_user_id}
            onChange={(v) => patch({ agent_user_id: v })}
            disabled={agentItems.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Направление торговли"
            searchPlaceholder="Направление"
            triggerClassName={ordersFilterRowSelect}
            items={selectItems(refs.tradeDirectionFilterOpts)}
            value={draft.trade_direction_ref}
            onChange={(v) => patch({ trade_direction_ref: v })}
            disabled={refs.tradeDirectionFilterOpts.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Способ оплаты"
            searchPlaceholder="Способ оплаты"
            triggerClassName={ordersFilterRowSelect}
            items={selectItems(refs.paymentMethodFilterOpts)}
            value={draft.payment_method_ref}
            onChange={(v) => patch({ payment_method_ref: v })}
            disabled={refs.paymentMethodFilterOpts.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Склад"
            searchPlaceholder="Склад"
            triggerClassName={ordersFilterRowSelect}
            items={warehouseItems}
            value={draft.warehouse_id}
            onChange={(v) => patch({ warehouse_id: v })}
            disabled={warehouseItems.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Зона"
            searchPlaceholder="Зона"
            triggerClassName={ordersFilterRowSelect}
            items={zoneItems}
            value={draft.zone}
            onChange={(v) => patch({ zone: v, region: "", city: "" })}
            disabled={zoneItems.length === 0}
            minPopoverWidth={260}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Область"
            searchPlaceholder="Область"
            triggerClassName={ordersFilterRowSelect}
            items={regionItems}
            value={draft.region}
            onChange={(v) => patch({ region: v, city: "" })}
            disabled={regionItems.length === 0}
            minPopoverWidth={280}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Город"
            searchPlaceholder="Город"
            triggerClassName={ordersFilterRowSelect}
            items={cityItems}
            value={draft.city}
            onChange={(v) => patch({ city: v })}
            disabled={cityItems.length === 0}
            minPopoverWidth={280}
          />
        </div>
        <FilterActions onApply={onApply} onReset={onReset} />
      </div>
    </div>
  );
}

export function AutoConfirmFiltersBar({
  draft,
  onChange,
  onApply,
  onReset,
  refs
}: {
  draft: AutoConfirmFilterDraft;
  onChange: (d: AutoConfirmFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
  refs: RefProps;
}) {
  const patch = (p: Partial<AutoConfirmFilterDraft>) => onChange({ ...draft, ...p });

  const agentItems = useMemo(
    () => refs.agents.map((a) => ({ id: String(a.id), title: a.fio })),
    [refs.agents]
  );
  const warehouseItems = useMemo(
    () => refs.warehouses.map((w) => ({ id: String(w.id), title: w.name })),
    [refs.warehouses]
  );

  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Тип выполнения"
            searchPlaceholder="Тип выполнения"
            triggerClassName={ordersFilterRowSelect}
            items={EXECUTION_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
            value={draft.execution_type}
            onChange={(v) => patch({ execution_type: v })}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Тип заявки"
            searchPlaceholder="Тип заявки"
            triggerClassName={ordersFilterRowSelect}
            items={selectItems(refs.requestTypeFilterOpts)}
            value={draft.request_type_ref}
            onChange={(v) => patch({ request_type_ref: v })}
            disabled={refs.requestTypeFilterOpts.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Агент"
            searchPlaceholder="Агент"
            triggerClassName={ordersFilterRowSelect}
            items={agentItems}
            value={draft.agent_user_id}
            onChange={(v) => patch({ agent_user_id: v })}
            disabled={agentItems.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Направление торговли"
            searchPlaceholder="Направление"
            triggerClassName={ordersFilterRowSelect}
            items={selectItems(refs.tradeDirectionFilterOpts)}
            value={draft.trade_direction_ref}
            onChange={(v) => patch({ trade_direction_ref: v })}
            disabled={refs.tradeDirectionFilterOpts.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Способ оплаты"
            searchPlaceholder="Способ оплаты"
            triggerClassName={ordersFilterRowSelect}
            items={selectItems(refs.paymentMethodFilterOpts)}
            value={draft.payment_method_ref}
            onChange={(v) => patch({ payment_method_ref: v })}
            disabled={refs.paymentMethodFilterOpts.length === 0}
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-[200px]">
          <OrdersListSingleMultiFilter
            placeholder="Склад"
            searchPlaceholder="Склад"
            triggerClassName={ordersFilterRowSelect}
            items={warehouseItems}
            value={draft.warehouse_id}
            onChange={(v) => patch({ warehouse_id: v })}
            disabled={warehouseItems.length === 0}
          />
        </div>
        <FilterActions onApply={onApply} onReset={onReset} />
      </div>
    </div>
  );
}

function FilterActions({ onApply, onReset }: { onApply: () => void; onReset: () => void }) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-border p-2 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600"
        title="Сбросить"
      >
        <RotateCcw size={16} />
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm text-white transition-colors hover:bg-teal-700"
      >
        <Filter size={14} />
        Применить
      </button>
    </div>
  );
}
