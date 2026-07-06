"use client";

import { ClientsTemplateSelectField, type TemplateSelectOption } from "@/components/clients/clients-template-select-field";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  joinMultiFilterValues,
  locationToUi,
  parseLocationUi,
  parseTristateUi,
  splitMultiFilterValues,
  tristateToUi,
  uiFromSingleValue
} from "@/lib/client-filter-select-value";
import type { ClientToolbarFiltersState } from "@/lib/client-list-toolbar-filters";
import type { RefSelectOption } from "@/lib/ref-select-options";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

const YES_NO_ALL: TemplateSelectOption[] = [
  { value: "all", label: "Все" },
  { value: "yes", label: "Да" },
  { value: "no", label: "Нет" }
];

const LOCATION_OPTS: TemplateSelectOption[] = [
  { value: "all", label: "Все" },
  { value: "yes", label: "Есть" },
  { value: "no", label: "Нет" }
];

const WEEKDAY_OPTS: TemplateSelectOption[] = [
  { value: "1", label: "Пн" },
  { value: "2", label: "Вт" },
  { value: "3", label: "Ср" },
  { value: "4", label: "Чт" },
  { value: "5", label: "Пт" },
  { value: "6", label: "Сб" },
  { value: "7", label: "Вс" }
];

const STATUS_OPTS: TemplateSelectOption[] = [
  { value: "active", label: "Активный" },
  { value: "inactive", label: "Не активный" }
];

const INN_OPTS: TemplateSelectOption[] = [
  { value: "has_inn", label: "С ИНН" },
  { value: "no_inn", label: "Без ИНН" }
];

const PHONE_OPTS: TemplateSelectOption[] = [
  { value: "has_phone", label: "Есть" },
  { value: "no_phone", label: "Нет" }
];

function shiftYmd(ymd: string, deltaMonths: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + deltaMonths, d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

type FilterRowItem = {
  id: string;
  label: string;
  options: TemplateSelectOption[];
  values: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
};

type Props = {
  draft: ClientToolbarFiltersState;
  onDraftChange: (patch: Partial<ClientToolbarFiltersState>) => void;
  onApply: () => void;
  onReset: () => void;
  onDateRangeApplied: (dateFrom: string, dateTo: string) => void;
  categorySelectOptions: RefSelectOption[];
  clientTypeSelectOptions: RefSelectOption[];
  clientFormatSelectOptions: RefSelectOption[];
  salesChannelSelectOptions: RefSelectOption[];
  equipmentSelectOptions: RefSelectOption[];
  territoryCascade: { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] };
  agentOptions: Array<{ id: number; name: string; login: string }>;
  expeditorOptions: Array<{ id: number; name: string; login: string }>;
  supervisorOptions: Array<{ id: number; name: string; login: string }>;
};

export function ClientsTemplateFiltersPanel({
  draft,
  onDraftChange,
  onApply,
  onReset,
  onDateRangeApplied,
  categorySelectOptions,
  clientTypeSelectOptions,
  clientFormatSelectOptions,
  salesChannelSelectOptions,
  equipmentSelectOptions,
  territoryCascade,
  agentOptions,
  expeditorOptions,
  supervisorOptions
}: Props) {
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  const patch = useCallback(
    (p: Partial<ClientToolbarFiltersState>) => onDraftChange(p),
    [onDraftChange]
  );

  const agentOpts = useMemo(
    () =>
      agentOptions.map((a) => ({
        value: String(a.id),
        label: `${a.name}${a.login ? ` (${a.login})` : ""}`,
        searchText: a.login
      })),
    [agentOptions]
  );
  const expeditorOpts = useMemo(
    () =>
      expeditorOptions.map((a) => ({
        value: String(a.id),
        label: `${a.name}${a.login ? ` (${a.login})` : ""}`,
        searchText: a.login
      })),
    [expeditorOptions]
  );
  const supervisorOpts = useMemo(
    () =>
      supervisorOptions.map((a) => ({
        value: String(a.id),
        label: a.name,
        searchText: a.login
      })),
    [supervisorOptions]
  );

  const dateLabel =
    draft.createdFrom && draft.createdTo
      ? formatDateRangeButton(draft.createdFrom, draft.createdTo)
      : "Выберите период";

  const row1: FilterRowItem[] = [
    {
      id: "agent",
      label: "Агент",
      multi: true,
      options: agentOpts,
      values: splitMultiFilterValues(draft.agentFilter),
      onChange: (v) => patch({ agentFilter: joinMultiFilterValues(v) })
    },
    {
      id: "clientType",
      label: "Тип клиента",
      options: clientTypeSelectOptions,
      values: uiFromSingleValue(draft.clientTypeFilter),
      onChange: (v) => patch({ clientTypeFilter: v[0]?.trim() ?? "" })
    },
    {
      id: "category",
      label: "Категория клиента",
      options: categorySelectOptions,
      values: uiFromSingleValue(draft.categoryFilter),
      onChange: (v) => patch({ categoryFilter: v[0]?.trim() ?? "" })
    },
    {
      id: "format",
      label: "Формат клиента",
      options: clientFormatSelectOptions,
      values: uiFromSingleValue(draft.clientFormatFilter),
      onChange: (v) => patch({ clientFormatFilter: v[0]?.trim() ?? "" })
    },
    {
      id: "supervisor",
      label: "Супервайзер",
      multi: true,
      options: supervisorOpts,
      values: splitMultiFilterValues(draft.supervisorFilter),
      onChange: (v) => patch({ supervisorFilter: joinMultiFilterValues(v) })
    },
    {
      id: "channel",
      label: "Канал продаж",
      options: salesChannelSelectOptions,
      values: uiFromSingleValue(draft.salesChannelFilter),
      onChange: (v) => patch({ salesChannelFilter: v[0]?.trim() ?? "" })
    },
    {
      id: "day",
      label: "День",
      multi: true,
      options: WEEKDAY_OPTS,
      values: splitMultiFilterValues(draft.visitWeekdayFilter),
      onChange: (v) => patch({ visitWeekdayFilter: joinMultiFilterValues(v) })
    }
  ];

  const row2: FilterRowItem[] = [
    {
      id: "expeditor",
      label: "Экспедиторы",
      multi: true,
      options: expeditorOpts,
      values: splitMultiFilterValues(draft.expeditorFilter),
      onChange: (v) => patch({ expeditorFilter: joinMultiFilterValues(v) })
    },
    {
      id: "status",
      label: "Статус",
      options: STATUS_OPTS,
      values:
        draft.activeFilter === "true"
          ? ["active"]
          : draft.activeFilter === "false"
            ? ["inactive"]
            : [],
      onChange: (v) => {
        const x = v[0]?.trim();
        if (x === "active") patch({ activeFilter: "true" });
        else if (x === "inactive") patch({ activeFilter: "false" });
        else patch({ activeFilter: "all" });
      }
    },
    {
      id: "location",
      label: "Локация",
      options: LOCATION_OPTS,
      values: locationToUi(draft.locationFilter),
      onChange: (v) => patch({ locationFilter: parseLocationUi(v) })
    },
    {
      id: "equipment",
      label: "Тип оборудования",
      options: equipmentSelectOptions,
      values: uiFromSingleValue(draft.equipmentKindFilter),
      onChange: (v) => patch({ equipmentKindFilter: v[0]?.trim() ?? "" })
    },
    {
      id: "inn",
      label: "ИНН",
      options: INN_OPTS,
      values:
        draft.innFilter === "__has__" ? ["has_inn"] : draft.innFilter === "__none__" ? ["no_inn"] : [],
      onChange: (v) => {
        const x = v[0]?.trim();
        if (x === "has_inn") patch({ innFilter: "__has__" });
        else if (x === "no_inn") patch({ innFilter: "__none__" });
        else patch({ innFilter: "" });
      }
    },
    {
      id: "hasInventory",
      label: "Есть инвентарь",
      options: YES_NO_ALL,
      values: tristateToUi(draft.hasInventoryFilter),
      onChange: (v) => patch({ hasInventoryFilter: parseTristateUi(v) })
    },
    {
      id: "phone",
      label: "Телефон",
      options: PHONE_OPTS,
      values:
        draft.phoneFilter === "__has__"
          ? ["has_phone"]
          : draft.phoneFilter === "__none__"
            ? ["no_phone"]
            : [],
      onChange: (v) => {
        const x = v[0]?.trim();
        if (x === "has_phone") patch({ phoneFilter: "__has__" });
        else if (x === "no_phone") patch({ phoneFilter: "__none__" });
        else patch({ phoneFilter: "" });
      }
    }
  ];

  const row3: FilterRowItem[] = [
    {
      id: "debtOrder",
      label: "Можно заказать в долге",
      options: YES_NO_ALL,
      values: tristateToUi(draft.creditAllowedFilter),
      onChange: (v) => patch({ creditAllowedFilter: parseTristateUi(v) })
    },
    {
      id: "consignStock",
      label: "Можно заказать с конси...",
      options: YES_NO_ALL,
      values: tristateToUi(draft.consignmentFilter),
      onChange: (v) => patch({ consignmentFilter: parseTristateUi(v) })
    },
    {
      id: "consign",
      label: "Можно заказать с конси...",
      options: YES_NO_ALL,
      values: tristateToUi(draft.consignmentLimitedFilter),
      onChange: (v) => patch({ consignmentLimitedFilter: parseTristateUi(v) })
    },
    {
      id: "zone",
      label: "Зона",
      multi: true,
      options: territoryCascade.zones,
      values: splitMultiFilterValues(draft.zoneFilter),
      onChange: (v) => patch({ zoneFilter: joinMultiFilterValues(v), regionFilter: "", cityFilter: "" })
    },
    {
      id: "region",
      label: "Область",
      options: territoryCascade.regions,
      values: uiFromSingleValue(draft.regionFilter),
      onChange: (v) => patch({ regionFilter: v[0]?.trim() ?? "", cityFilter: "" })
    },
    {
      id: "city",
      label: "Город",
      options: territoryCascade.cities,
      values: uiFromSingleValue(draft.cityFilter),
      onChange: (v) => patch({ cityFilter: v[0]?.trim() ?? "" })
    }
  ];

  const renderRow = (items: FilterRowItem[]) => (
    <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
      {items.map((f) => (
        <ClientsTemplateSelectField
          key={f.id}
          label={f.label}
          options={f.options}
          values={f.values}
          onChange={f.onChange}
          multi={f.multi ?? false}
        />
      ))}
    </div>
  );

  return (
    <div className="w-full rounded-lg border border-border bg-card px-4 pb-3 pt-4 shadow-sm sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">Клиенты</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <span className="mr-1 text-xs font-medium text-gray-600">📅 Дата</span>
            <button
              type="button"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => {
                if (!draft.createdFrom || !draft.createdTo) return;
                onDateRangeApplied(shiftYmd(draft.createdFrom, -1), shiftYmd(draft.createdTo, -1));
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
                if (!draft.createdFrom || !draft.createdTo) return;
                onDateRangeApplied(shiftYmd(draft.createdFrom, 1), shiftYmd(draft.createdTo, 1));
              }}
              aria-label="Следующий период"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link
            href="/clients/new"
            className="whitespace-nowrap rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Добавить клиента
          </Link>
        </div>
      </div>

      {renderRow(row1)}
      {renderRow(row2)}

      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        {row3.map((f) => (
          <ClientsTemplateSelectField
            key={f.id}
            label={f.label}
            options={f.options}
            values={f.values}
            onChange={f.onChange}
            multi={f.multi ?? false}
          />
        ))}
        <div className="col-span-2 flex items-center gap-2 sm:col-span-1 xl:col-span-1">
          <button
            type="button"
            title="Сбросить"
            onClick={onReset}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={onApply}
            className="h-[38px] flex-1 whitespace-nowrap rounded-lg bg-emerald-500 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Применить
          </button>
        </div>
      </div>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.createdFrom}
        dateTo={draft.createdTo}
        onApply={({ dateFrom, dateTo }) => onDateRangeApplied(dateFrom, dateTo)}
      />
    </div>
  );
}
