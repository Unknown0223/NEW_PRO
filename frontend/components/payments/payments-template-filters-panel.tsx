"use client";

import {
  ClientsTemplateSelectField,
  type TemplateSelectOption
} from "@/components/clients/clients-template-select-field";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  joinMultiFilterValues,
  splitMultiFilterValues,
  uiFromSingleValue
} from "@/lib/client-filter-select-value";
import type { PaymentFilterVisibility } from "@/lib/payment-filters-visibility";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

type DealType = "regular" | "consignment" | "both";

export type PaymentsFilterDraft = {
  deal_type: DealType;
  date_from: string;
  date_to: string;
  payment_status: string;
  cash_desk_id: string;
  agent_id: string;
  expeditor_user_id: string;
  payment_type: string;
  trade_direction: string;
  territory_zone: string;
  territory_region: string;
  territory_city: string;
  amount_min: string;
  amount_max: string;
};

type Props = {
  title: string;
  isExpenses?: boolean;
  draft: PaymentsFilterDraft;
  filterVis: PaymentFilterVisibility;
  statusOptions: TemplateSelectOption[];
  cashDeskOptions: TemplateSelectOption[];
  agentOptions: TemplateSelectOption[];
  expeditorOptions: TemplateSelectOption[];
  paymentMethodOptions: TemplateSelectOption[];
  tradeDirectionOptions: TemplateSelectOption[];
  zoneOptions: TemplateSelectOption[];
  regionOptions: TemplateSelectOption[];
  cityOptions: TemplateSelectOption[];
  amountMinDisplay: number;
  amountMaxDisplay: number;
  amountSliderMax: number;
  onDraftChange: (patch: Partial<PaymentsFilterDraft>) => void;
  onApply: () => void;
  onReset: () => void;
  onDateRangeApplied: (dateFrom: string, dateTo: string) => void;
  onAddPayment: () => void;
  addButtonLabel: string;
};

function shiftYmd(ymd: string, deltaMonths: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function PaymentsTemplateFiltersPanel({
  title,
  isExpenses = false,
  draft,
  filterVis,
  statusOptions,
  cashDeskOptions,
  agentOptions,
  expeditorOptions,
  paymentMethodOptions,
  tradeDirectionOptions,
  zoneOptions,
  regionOptions,
  cityOptions,
  amountMinDisplay,
  amountMaxDisplay,
  amountSliderMax,
  onDraftChange,
  onApply,
  onReset,
  onDateRangeApplied,
  onAddPayment,
  addButtonLabel
}: Props) {
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const dateLabel =
    draft.date_from && draft.date_to
      ? formatDateRangeButton(draft.date_from, draft.date_to)
      : "Выберите период";

  const rowClass = "mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7";

  const row1 = [
    filterVis.status ? (
      <ClientsTemplateSelectField
        key="status"
        label="Статус"
        options={statusOptions}
        values={uiFromSingleValue(draft.payment_status)}
        onChange={(v) => onDraftChange({ payment_status: v[0]?.trim() ?? "" })}
      />
    ) : null,
    filterVis.cash_desk ? (
      <ClientsTemplateSelectField
        key="cash"
        label="Касса"
        multi
        options={cashDeskOptions}
        values={splitMultiFilterValues(draft.cash_desk_id)}
        onChange={(v) => onDraftChange({ cash_desk_id: joinMultiFilterValues(v) })}
      />
    ) : null,
    filterVis.agent ? (
      <ClientsTemplateSelectField
        key="agent"
        label="Агент"
        multi
        options={agentOptions}
        values={splitMultiFilterValues(draft.agent_id)}
        onChange={(v) => onDraftChange({ agent_id: joinMultiFilterValues(v) })}
      />
    ) : null,
    filterVis.expeditor ? (
      <ClientsTemplateSelectField
        key="expeditor"
        label="Экспедитор"
        multi
        options={expeditorOptions}
        values={splitMultiFilterValues(draft.expeditor_user_id)}
        onChange={(v) => onDraftChange({ expeditor_user_id: joinMultiFilterValues(v) })}
      />
    ) : null,
    filterVis.payment_type ? (
      <ClientsTemplateSelectField
        key="payment"
        label="Способ оплаты"
        options={paymentMethodOptions}
        values={uiFromSingleValue(draft.payment_type)}
        onChange={(v) => onDraftChange({ payment_type: v[0]?.trim() ?? "" })}
      />
    ) : null,
    filterVis.trade_direction ? (
      <ClientsTemplateSelectField
        key="trade"
        label="Направление торг..."
        options={tradeDirectionOptions}
        values={uiFromSingleValue(draft.trade_direction)}
        onChange={(v) => onDraftChange({ trade_direction: v[0]?.trim() ?? "" })}
      />
    ) : null,
    filterVis.territory1 ? (
      <ClientsTemplateSelectField
        key="zone"
        label="Зона"
        options={zoneOptions}
        values={uiFromSingleValue(draft.territory_zone)}
        onChange={(v) =>
          onDraftChange({
            territory_zone: v[0]?.trim() ?? "",
            territory_region: "",
            territory_city: ""
          })
        }
      />
    ) : null
  ].filter(Boolean);

  return (
    <div className="w-full rounded-lg border border-border bg-card px-4 pb-3 pt-4 shadow-sm sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {!isExpenses ? (
            <div className="hidden items-center gap-3 text-sm text-gray-600 lg:flex">
              <span className="text-xs text-gray-500">Тип заявки</span>
              {(
                [
                  ["regular", "Обычная"],
                  ["consignment", "Для консигнации"],
                  ["both", "Обе"]
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="deal_type"
                    className="h-4 w-4 accent-emerald-500"
                    checked={draft.deal_type === value}
                    onChange={() => onDraftChange({ deal_type: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <span className="mr-1 text-xs font-medium text-gray-600">📅 Дата</span>
            <button
              type="button"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => {
                if (!draft.date_from || !draft.date_to) return;
                onDateRangeApplied(shiftYmd(draft.date_from, -1), shiftYmd(draft.date_to, -1));
              }}
              aria-label="Предыдущий период"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              ref={dateAnchorRef}
              type="button"
              onClick={() => setDateOpen(true)}
              className="mx-1 whitespace-nowrap font-medium text-gray-700 hover:text-emerald-700"
            >
              {dateLabel}
            </button>
            <button
              type="button"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => {
                if (!draft.date_from || !draft.date_to) return;
                onDateRangeApplied(shiftYmd(draft.date_from, 1), shiftYmd(draft.date_to, 1));
              }}
              aria-label="Следующий период"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onAddPayment}
            className="whitespace-nowrap rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-900"
          >
            {addButtonLabel}
          </button>
        </div>
      </div>

      {row1.length > 0 ? <div className={rowClass}>{row1}</div> : null}

      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        {filterVis.territory2 ? (
          <ClientsTemplateSelectField
            label="Область"
            options={regionOptions}
            values={uiFromSingleValue(draft.territory_region)}
            onChange={(v) =>
              onDraftChange({ territory_region: v[0]?.trim() ?? "", territory_city: "" })
            }
          />
        ) : null}
        {filterVis.territory3 ? (
          <ClientsTemplateSelectField
            label="Город"
            options={cityOptions}
            values={uiFromSingleValue(draft.territory_city)}
            onChange={(v) => onDraftChange({ territory_city: v[0]?.trim() ?? "" })}
          />
        ) : null}
        {!isExpenses && filterVis.amount ? (
          <div className="col-span-2 flex flex-col gap-1 xl:col-span-3">
            <span className="text-xs font-medium text-gray-600">
              Сумма: от {amountMinDisplay.toLocaleString("ru-RU")} до{" "}
              {amountMaxDisplay.toLocaleString("ru-RU")}
            </span>
            <input
              type="range"
              className="h-1.5 w-full cursor-pointer accent-emerald-500"
              min={0}
              max={amountSliderMax}
              value={amountMaxDisplay}
              onChange={(e) =>
                onDraftChange({ amount_max: String(Number.parseInt(e.target.value, 10) || 0) })
              }
            />
          </div>
        ) : null}
        <div className="col-span-2 flex items-stretch gap-2 sm:col-span-2 md:col-span-1 xl:col-span-1 xl:ml-auto">
          <button
            type="button"
            title="Сбросить"
            onClick={onReset}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-[18px] w-[18px] text-gray-600" />
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-[42px] min-w-[120px] flex-1 whitespace-nowrap rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Применить
          </button>
        </div>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.date_from}
        dateTo={draft.date_to}
        onApply={({ dateFrom, dateTo }) => onDateRangeApplied(dateFrom, dateTo)}
      />
    </div>
  );
}
