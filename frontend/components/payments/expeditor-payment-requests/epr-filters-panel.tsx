"use client";

import {
  ClientsTemplateSelectField,
  type TemplateSelectOption
} from "@/components/clients/clients-template-select-field";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { uiFromSingleValue } from "@/lib/client-filter-select-value";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import type { DealType, EprFilterState, StatusFilter } from "./expeditor-payment-requests-types";

function shiftYmd(ymd: string, deltaMonths: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

type Props = {
  draft: EprFilterState;
  expeditorOptions: TemplateSelectOption[];
  agentOptions: TemplateSelectOption[];
  paymentMethodOptions: TemplateSelectOption[];
  tradeDirectionOptions: TemplateSelectOption[];
  territoryOptions: { key: string; label: string; options: TemplateSelectOption[]; value: string }[];
  onDraftChange: (patch: Partial<EprFilterState>) => void;
  onApply: () => void;
  onReset: () => void;
};

export function EprFiltersPanel({
  draft,
  expeditorOptions,
  agentOptions,
  paymentMethodOptions,
  tradeDirectionOptions,
  territoryOptions,
  onDraftChange,
  onApply,
  onReset
}: Props) {
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const dateLabel =
    draft.dateFrom && draft.dateTo
      ? formatDateRangeButton(draft.dateFrom, draft.dateTo)
      : "Выберите период";

  const statusOptions: TemplateSelectOption[] = [
    { value: "", label: "Все" },
    { value: "pending_confirmation", label: "Ожидание подтверждения" },
    { value: "confirmed", label: "Подтверждено" },
    { value: "rejected", label: "Отклонено" }
  ];

  return (
    <section className="mb-4 rounded-2xl bg-card px-5 py-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Фильтр</h2>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-slate-600">
            <span className="text-[11px] text-slate-500">Тип заявки</span>
            {(
              [
                ["regular", "Обычная"],
                ["consignment", "Для консигнации"],
                ["both", "Обе"]
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-1.5 text-slate-600">
                <input
                  type="radio"
                  name="epr_deal_type"
                  className="size-3.5 accent-teal-700"
                  checked={draft.dealType === value}
                  onChange={() => onDraftChange({ dealType: value as DealType })}
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex h-10 items-center overflow-hidden rounded-xl border border-border bg-card text-xs text-slate-700">
            <button
              type="button"
              className="h-full px-3 text-slate-400 hover:bg-muted"
              onClick={() => {
                if (!draft.dateFrom || !draft.dateTo) return;
                onDraftChange({
                  dateFrom: shiftYmd(draft.dateFrom, -1),
                  dateTo: shiftYmd(draft.dateTo, -1)
                });
              }}
              aria-label="Предыдущий период"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              ref={dateAnchorRef}
              type="button"
              className="flex h-full min-w-[200px] flex-col items-start justify-center px-3 text-left leading-tight"
              onClick={() => setDateOpen(true)}
            >
              <span className="text-[10px] text-slate-400">Дата</span>
              <span className="font-medium text-slate-700">{dateLabel}</span>
            </button>
            <button
              type="button"
              className="h-full px-3 text-slate-400 hover:bg-muted"
              onClick={() => {
                if (!draft.dateFrom || !draft.dateTo) return;
                onDraftChange({
                  dateFrom: shiftYmd(draft.dateFrom, 1),
                  dateTo: shiftYmd(draft.dateTo, 1)
                });
              }}
              aria-label="Следующий период"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <DateRangePopover
            open={dateOpen}
            onOpenChange={setDateOpen}
            anchorRef={dateAnchorRef}
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onApply={({ dateFrom, dateTo }) => onDraftChange({ dateFrom, dateTo })}
          />

          <button
            type="button"
            onClick={onReset}
            className="grid size-10 place-items-center rounded-xl border border-border bg-card text-slate-500 hover:bg-muted"
            title="Сбросить"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-10 rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Применить
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="w-[170px]">
          <ClientsTemplateSelectField
            label="Экспедитор"
            multi
            options={expeditorOptions}
            values={draft.expeditorIds.map(String)}
            onChange={(v) =>
              onDraftChange({
                expeditorIds: v.map((x) => Number.parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0)
              })
            }
          />
        </div>
        <div className="w-[170px]">
          <ClientsTemplateSelectField
            label="Направление торговли"
            options={tradeDirectionOptions}
            values={uiFromSingleValue(draft.tradeDirection)}
            onChange={(v) => onDraftChange({ tradeDirection: v[0]?.trim() ?? "" })}
          />
        </div>
        <div className="w-[170px]">
          <ClientsTemplateSelectField
            label="Способ оплаты"
            options={paymentMethodOptions}
            values={uiFromSingleValue(draft.paymentType)}
            onChange={(v) => onDraftChange({ paymentType: v[0]?.trim() ?? "" })}
          />
        </div>
        <div className="w-[170px]">
          <ClientsTemplateSelectField
            label="Статус"
            searchable={false}
            options={statusOptions}
            values={uiFromSingleValue(draft.status)}
            onChange={(v) => onDraftChange({ status: (v[0]?.trim() ?? "") as StatusFilter })}
          />
        </div>
        <div className="w-[170px]">
          <ClientsTemplateSelectField
            label="Агент"
            multi
            options={agentOptions}
            values={draft.agentIds.map(String)}
            onChange={(v) =>
              onDraftChange({
                agentIds: v.map((x) => Number.parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 0)
              })
            }
          />
        </div>
        {territoryOptions.map((t) => (
          <div key={t.key} className="w-[170px]">
            <ClientsTemplateSelectField
              label={t.label}
              options={t.options}
              values={uiFromSingleValue(t.value)}
              onChange={(v) => onDraftChange({ [t.key]: v[0]?.trim() ?? "" } as Partial<EprFilterState>)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
