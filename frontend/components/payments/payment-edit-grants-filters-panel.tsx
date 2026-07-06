"use client";

import {
  ClientsTemplateSelectField,
  type TemplateSelectOption
} from "@/components/clients/clients-template-select-field";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { uiFromSingleValue } from "@/lib/client-filter-select-value";
import { ChevronLeft, ChevronRight, Filter, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

export type EditGrantsFilterDraft = {
  date_from: string;
  date_to: string;
  status: string;
  access_user_id: string;
  cancel_reason_ref: string;
};

type Props = {
  draft: EditGrantsFilterDraft;
  statusOptions: TemplateSelectOption[];
  expeditorOptions: TemplateSelectOption[];
  reasonOptions: TemplateSelectOption[];
  onDraftChange: (patch: Partial<EditGrantsFilterDraft>) => void;
  onApply: () => void;
  onReset: () => void;
  onDateRangeApplied: (dateFrom: string, dateTo: string) => void;
};

function shiftYmd(ymd: string, deltaMonths: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function PaymentEditGrantsFiltersPanel({
  draft,
  statusOptions,
  expeditorOptions,
  reasonOptions,
  onDraftChange,
  onApply,
  onReset,
  onDateRangeApplied
}: Props) {
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const dateLabel =
    draft.date_from && draft.date_to
      ? formatDateRangeButton(draft.date_from, draft.date_to)
      : "Выберите период";

  return (
    <div className="w-full rounded-lg border border-border bg-card px-4 pb-3 pt-4 shadow-sm sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          Список платежей, разрешенных для изменения
        </h2>
        <div className="flex flex-wrap items-center gap-3">
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
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
            title="Фильтры"
          >
            <Filter className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <ClientsTemplateSelectField
          label="Статус"
          options={statusOptions}
          values={uiFromSingleValue(draft.status)}
          onChange={(v) => onDraftChange({ status: v[0]?.trim() ?? "" })}
        />
        <ClientsTemplateSelectField
          label="Экспедитор"
          options={expeditorOptions}
          values={uiFromSingleValue(draft.access_user_id)}
          onChange={(v) => onDraftChange({ access_user_id: v[0]?.trim() ?? "" })}
        />
        <ClientsTemplateSelectField
          label="Причины отмены оп..."
          options={reasonOptions}
          values={uiFromSingleValue(draft.cancel_reason_ref)}
          onChange={(v) => onDraftChange({ cancel_reason_ref: v[0]?.trim() ?? "" })}
        />
      </div>

      <div className="flex items-stretch justify-end gap-2">
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
          className="h-[42px] min-w-[120px] rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
        >
          Применить
        </button>
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
