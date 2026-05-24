"use client";

import { useMemo } from "react";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { fieldClass, POLKI_SKIDKA_OPTS } from "../../constants";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { ReturnAutoBonusWarningsStrip } from "./return-auto-bonus-warnings-strip";
import { ReturnPolkiBonusModeBlock } from "./return-bonus-calc-block";
import { PolkiFloatingField } from "./polki-floating-field";
import { polkiCard } from "./polki-return-ui";
import { POLKI_RETURN_MODE_META } from "./polki-return-mode";
import { tradeDirectionOptionsFromProfile } from "./polki-trade-direction-options";

const selectFieldClass = cn(
  fieldClass,
  "h-[46px] pt-3 text-sm focus-visible:border-[#0a8f7e] focus-visible:ring-[#0a8f7e]/15"
);

export function ReturnOrderDataColumn({ vm }: { vm: OrderCreateVm }) {
  const {
    mutation,
    loadingLists,
    createCtxQ,
    warehouseId,
    warehouses,
    setWarehouseId,
    setSelectionNotice,
    canPickWarehouse,
    isPolkiByOrder,
    isPolkiFree,
    polkiOrderIds,
    canShowPolkiGrid,
    agentId,
    agentFilterOptions,
    setAgentId,
    polkiTradeDirection,
    setPolkiTradeDirection,
    polkiSkidkaType,
    setPolkiSkidkaType,
    polkiOrderFieldsFromOrder,
    polkiOrdersForPick
  } = vm;

  const mode = isPolkiByOrder ? POLKI_RETURN_MODE_META.by_order : POLKI_RETURN_MODE_META.free;
  const fieldsLocked = Boolean(polkiOrderFieldsFromOrder);
  const selectedOrderNumber =
    polkiOrderIds.length === 1
      ? polkiOrdersForPick.find((o) => o.id === polkiOrderIds[0])?.number
      : null;
  const showPolkiBonusMode =
    mode.showPolkiBonusMode &&
    canShowPolkiGrid &&
    (!mode.requireOrderSelection || polkiOrderIds.length > 0);
  const showAutoBonus =
    mode.showAutoBonusBlock &&
    canShowPolkiGrid &&
    (!mode.requireOrderSelection || polkiOrderIds.length > 0);

  const tradeDirectionOptions = useMemo(
    () =>
      tradeDirectionOptionsFromProfile(
        createCtxQ.data?.settings_profile?.references?.trade_directions
      ),
    [createCtxQ.data?.settings_profile?.references?.trade_directions]
  );

  return (
    <div className={cn(polkiCard, "space-y-4 p-5")}>
      <div>
        <h2 className="text-[15px] font-semibold text-slate-800">Данные заказа</h2>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {isPolkiFree
            ? "Клиент и склад возврата — достаточно для загрузки всех доставленных позиций."
            : "Сначала выберите заказ справа — агент, склад, тип цены и скидка подставятся из заказа. Категории и количества — вручную."}
        </p>
        {fieldsLocked && selectedOrderNumber ? (
          <p className="mt-2 rounded-md border border-teal-800/20 bg-teal-50/60 px-2.5 py-1.5 text-[10px] text-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
            Из заказа №{selectedOrderNumber}: параметры ниже зафиксированы. Можно менять только категории и
            строки возврата.
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <PolkiFloatingField label="Агент" htmlFor="oc-agent-p">
          <FilterSearchableSelect
            id="oc-agent-p"
            className={selectFieldClass}
            emptyLabel="—"
            value={agentId}
            options={agentFilterOptions}
            onValueChange={(v) => {
              setSelectionNotice(null);
              setAgentId(v);
            }}
            disabled={mutation.isPending || loadingLists || !canPickWarehouse || fieldsLocked}
            searchPlaceholder="Поиск: логин, имя"
            emptyMessage="Нет совпадений"
            minPopoverWidth={280}
            includeEmptyOption={!agentId.trim()}
          />
        </PolkiFloatingField>

        <PolkiFloatingField label="Склад для возврата" htmlFor="oc-warehouse-p">
          <FilterSelect
            id="oc-warehouse-p"
            data-testid="order-create-warehouse"
            className={selectFieldClass}
            emptyLabel="Склад…"
            aria-label="Склад для возврата"
            value={warehouseId}
            onChange={(e) => {
              setSelectionNotice(null);
              setWarehouseId(e.target.value);
            }}
            disabled={mutation.isPending || loadingLists || !canPickWarehouse || fieldsLocked}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.name}
                {w.stock_purpose === "return" ? " · возврат" : ""}
              </option>
            ))}
          </FilterSelect>
        </PolkiFloatingField>

        <PolkiFloatingField label="Направление торговли" htmlFor="oc-polki-trade">
          <select
            id="oc-polki-trade"
            className={selectFieldClass}
            value={polkiTradeDirection}
            onChange={(e) => setPolkiTradeDirection(e.target.value)}
            disabled={mutation.isPending || fieldsLocked}
          >
            {tradeDirectionOptions.map((o) => (
              <option key={o.value || "__empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </PolkiFloatingField>

        {mode.showSkidkaType ? (
          <PolkiFloatingField label="Тип скидки" htmlFor="oc-polki-skidka">
            <select
              id="oc-polki-skidka"
              className={selectFieldClass}
              value={polkiSkidkaType}
              onChange={(e) => setPolkiSkidkaType(e.target.value)}
              disabled={mutation.isPending || fieldsLocked}
            >
              {POLKI_SKIDKA_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PolkiFloatingField>
        ) : null}

        {showPolkiBonusMode ? <ReturnPolkiBonusModeBlock vm={vm} /> : null}
        {showAutoBonus ? <ReturnAutoBonusWarningsStrip vm={vm} /> : null}

        {isPolkiByOrder && polkiOrderIds.length === 0 && canPickWarehouse ? (
          <p className="rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
            Выберите один заказ в блоке «{mode.ordersListTitle}» справа — затем заполните состав в
            таблице.
          </p>
        ) : null}
      </div>

      {!canPickWarehouse ? (
        <p className="text-[11px] text-slate-500">Сначала выберите клиента.</p>
      ) : null}
    </div>
  );
}
