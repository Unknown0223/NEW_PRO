"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRuDateButton } from "@/components/ui/date-picker-popover";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { salePriceTypeOptionsFromProfile } from "./polki-price-type-options";
import { OldPricesModal } from "../old-prices-modal";
import {
  polkiCard,
  polkiRadioDot,
  polkiRadioDotActive,
  polkiRadioRow,
  polkiRadioRowActive
} from "./polki-return-ui";

export function ReturnPriceTypeColumn({ vm }: { vm: OrderCreateVm }) {
  const {
    mutation,
    createCtxQ,
    priceType,
    setPriceType,
    polkiOrderFieldsFromOrder,
    polkiOrdersForPick,
    polkiOrderIds,
    oldPrices,
    oldPricesEnabled,
    priceAsOf,
    clearOldPrices,
    oldPricesPriceTypeLabels
  } = vm;

  const fieldsLocked = Boolean(polkiOrderFieldsFromOrder);
  const selectedOrderNumber =
    polkiOrderIds.length === 1
      ? polkiOrdersForPick.find((o) => o.id === polkiOrderIds[0])?.number
      : null;

  const priceTypeOptions = useMemo(
    () =>
      salePriceTypeOptionsFromProfile(
        createCtxQ.data?.settings_profile?.references?.price_type_entries,
        createCtxQ.data?.price_types ?? []
      ),
    [createCtxQ.data?.settings_profile?.references?.price_type_entries, createCtxQ.data?.price_types]
  );

  const disabled = mutation.isPending || createCtxQ.isPending || fieldsLocked;

  return (
    <div className={polkiCard} data-oc-error="price">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">Тип цены</h2>
          {fieldsLocked && selectedOrderNumber ? (
            <p className="text-[10px] text-muted-foreground">Из заказа №{selectedOrderNumber}</p>
          ) : null}
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            oldPricesEnabled ? "text-teal-700" : "text-slate-600 hover:text-slate-900",
            disabled && "pointer-events-none opacity-50"
          )}
          disabled={disabled}
          onClick={() => {
            if (oldPricesEnabled) oldPrices.openOldPricesModal();
            else oldPrices.onOldPricesCheckboxChange(true);
          }}
          title="Старые цены"
        >
          Старые цены
          {oldPricesEnabled && priceAsOf ? (
            <span className="tabular-nums">({formatRuDateButton(priceAsOf)})</span>
          ) : null}
          <FileText className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {priceTypeOptions.length === 0 ? (
        <p className="text-xs text-slate-500">
          В настройках тенанта нет активных типов цен (продажа). Добавьте в «Настройки → Цены».
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {priceTypeOptions.map((p) => {
            const active = priceType === p.key;
            return (
              <label
                key={p.key}
                className={cn(polkiRadioRow, active && polkiRadioRowActive)}
              >
                <input
                  type="radio"
                  name="oc-polki-price-type"
                  className="sr-only"
                  checked={active}
                  onChange={() => {
                    clearOldPrices();
                    setPriceType(p.key);
                  }}
                  disabled={disabled}
                />
                <span className={cn(polkiRadioDot, active && polkiRadioDotActive)} />
                <span className="min-w-0 truncate">{p.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {oldPricesEnabled ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 rounded border-input"
            checked
            onChange={() => oldPrices.onOldPricesCheckboxChange(false)}
            disabled={disabled}
          />
          Старые цены включены — снять
        </label>
      ) : null}
      <OldPricesModal
        open={oldPrices.oldPricesOpen}
        onOpenChange={oldPrices.onOldPricesOpenChange}
        priceTypes={
          createCtxQ.data?.price_types?.length ? createCtxQ.data.price_types : ["retail"]
        }
        priceTypeLabels={oldPricesPriceTypeLabels}
        draftAsOf={oldPrices.draftAsOf}
        draftPriceType={oldPrices.draftPriceType}
        onDraftAsOfChange={oldPrices.setDraftAsOf}
        onDraftPriceTypeChange={oldPrices.setDraftPriceType}
        applying={oldPrices.applyingOldPrices}
        error={oldPrices.oldPricesApplyError}
        onConfirm={() => void oldPrices.applyOldPrices()}
        onRetry={() => void oldPrices.retryOldPrices()}
      />
    </div>
  );
}
