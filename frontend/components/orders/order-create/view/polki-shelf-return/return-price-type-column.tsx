"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { salePriceTypeOptionsFromProfile } from "./polki-price-type-options";
import {
  polkiCard,
  polkiRadioDot,
  polkiRadioDotActive,
  polkiRadioRow,
  polkiRadioRowActive
} from "./polki-return-ui";

export function ReturnPriceTypeColumn({ vm }: { vm: OrderCreateVm }) {
  const { mutation, createCtxQ, priceType, setPriceType, polkiOrderFieldsFromOrder, polkiOrdersForPick, polkiOrderIds } =
    vm;

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
    <div className={polkiCard}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">Тип цены</h2>
          {fieldsLocked && selectedOrderNumber ? (
            <p className="text-[10px] text-muted-foreground">Из заказа №{selectedOrderNumber}</p>
          ) : null}
        </div>
        <span
          className="inline-flex items-center gap-1 text-xs text-slate-400"
          title="Скоро"
        >
          Старые цены
          <FileText className="h-3.5 w-3.5" aria-hidden />
        </span>
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
                  onChange={() => setPriceType(p.key)}
                  disabled={disabled}
                />
                <span className={cn(polkiRadioDot, active && polkiRadioDotActive)} />
                <span className="min-w-0 truncate">{p.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
