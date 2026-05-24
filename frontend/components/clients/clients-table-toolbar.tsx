"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { Input } from "@/components/ui/input";
import type { ClientToolbarFiltersState } from "@/lib/client-list-toolbar-filters";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { cn } from "@/lib/utils";
import { CalendarDays, ListOrdered, Search } from "lucide-react";
import { useRef, useState } from "react";

const VISIT_WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "1", label: "Пн" },
  { value: "2", label: "Вт" },
  { value: "3", label: "Ср" },
  { value: "4", label: "Чт" },
  { value: "5", label: "Пт" },
  { value: "6", label: "Сб" },
  { value: "7", label: "Вс" }
];

function patchDraft(
  onDraftChange: (p: Partial<ClientToolbarFiltersState>) => void,
  patch: Partial<ClientToolbarFiltersState>
) {
  onDraftChange(patch);
}

export type ClientsTableListToolbarStripProps = {
  search: string;
  onSearchChange: (v: string) => void;
  pageLimit: number;
  onPageLimitChange: (v: number) => void;
  onOpenColumnSettings: () => void;
  /** Jadval kartochkasi ichida — pastki border bilan ajratiladi */
  totalRecords?: number;
};

type FiltersProps = {
  draft: ClientToolbarFiltersState;
  onDraftChange: (patch: Partial<ClientToolbarFiltersState>) => void;
  onApplyToolbar: () => void;
  categorySelectOptions: RefSelectOption[];
  /** Zona → viloyat → shahar: `buildZoneRegionCityCascadeOptions` */
  territoryCascade: { zones: RefSelectOption[]; regions: RefSelectOption[]; cities: RefSelectOption[] };
  clientTypeSelectOptions: RefSelectOption[];
  clientFormatSelectOptions: RefSelectOption[];
  salesChannelSelectOptions: RefSelectOption[];
  agentOptions: Array<{ id: number; name: string; login: string }>;
  expeditorOptions: Array<{ id: number; name: string; login: string }>;
  supervisorOptions: Array<{ id: number; name: string; login: string }>;
};

export function ClientsTableFilters({
  draft,
  onDraftChange,
  onApplyToolbar,
  categorySelectOptions,
  territoryCascade,
  clientTypeSelectOptions,
  clientFormatSelectOptions,
  salesChannelSelectOptions,
  agentOptions,
  expeditorOptions,
  supervisorOptions
}: FiltersProps) {
  const d = draft;
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [territorySelectCloseTok, setTerritorySelectCloseTok] = useState(0);
  const bumpTerritoryClose = () => setTerritorySelectCloseTok((n) => n + 1);
  const dateRangeLabel =
    d.createdFrom && d.createdTo ? formatDateRangeButton(d.createdFrom, d.createdTo) : "Выберите период";

  const filterGridClass =
    "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
  const territorySelectClass = cn(filterPanelSelectClassName, "h-9 min-h-9 w-full min-w-0 text-xs");

  return (
    <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
      <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex justify-end">
            <Button
              ref={dateRangeAnchorRef}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-[15rem] justify-between gap-2 text-left font-medium"
              onClick={() => setDateRangeOpen((v) => !v)}
            >
              <span className="truncate">{dateRangeLabel}</span>
              <CalendarDays className="h-4 w-4 shrink-0 opacity-75" />
            </Button>
          </div>

          <div className={`${filterGridClass} border-t border-border/60 pt-4`}>
            <label className="orders-filter-field-label">
              Статус
              <select
                className={filterPanelSelectClassName}
                value={d.activeFilter}
                onChange={(e) =>
                  patchDraft(onDraftChange, {
                    activeFilter: e.target.value as ClientToolbarFiltersState["activeFilter"]
                  })
                }
              >
                <option value="all">Все</option>
                <option value="true">Активный</option>
                <option value="false">Неактивный</option>
              </select>
            </label>
            <label className="orders-filter-field-label">
              Агент
              <select
                className={filterPanelSelectClassName}
                value={d.agentFilter}
                onChange={(e) => patchDraft(onDraftChange, { agentFilter: e.target.value })}
              >
                <option value="">Все</option>
                {agentOptions.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name} ({u.login})
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Тип клиента
              <select
                className={filterPanelSelectClassName}
                value={d.clientTypeFilter}
                onChange={(e) => patchDraft(onDraftChange, { clientTypeFilter: e.target.value })}
              >
                <option value="">Все</option>
                {clientTypeSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Категория клиента
              <select
                className={filterPanelSelectClassName}
                value={d.categoryFilter}
                onChange={(e) => patchDraft(onDraftChange, { categoryFilter: e.target.value })}
              >
                <option value="">Все</option>
                {categorySelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Формат клиента
              <select
                className={filterPanelSelectClassName}
                value={d.clientFormatFilter}
                onChange={(e) => patchDraft(onDraftChange, { clientFormatFilter: e.target.value })}
              >
                <option value="">Все</option>
                {clientFormatSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Супервайзер
              <select
                className={filterPanelSelectClassName}
                value={d.supervisorFilter}
                onChange={(e) => patchDraft(onDraftChange, { supervisorFilter: e.target.value })}
              >
                <option value="">Все</option>
                {supervisorOptions.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Канал продаж
              <select
                className={filterPanelSelectClassName}
                value={d.salesChannelFilter}
                onChange={(e) => patchDraft(onDraftChange, { salesChannelFilter: e.target.value })}
              >
                <option value="">Все</option>
                {salesChannelSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              День
              <select
                className={filterPanelSelectClassName}
                value={d.visitWeekdayFilter}
                onChange={(e) => patchDraft(onDraftChange, { visitWeekdayFilter: e.target.value })}
              >
                {VISIT_WEEKDAY_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="orders-filter-field-label">
              Экспедиторы
              <select
                className={filterPanelSelectClassName}
                value={d.expeditorFilter}
                onChange={(e) => patchDraft(onDraftChange, { expeditorFilter: e.target.value })}
              >
                <option value="">Все</option>
                {expeditorOptions.map((u) => (
                  <option key={`ex-${u.id}`} value={String(u.id)}>
                    {u.name} ({u.login})
                  </option>
                ))}
              </select>
            </label>
            <div className="orders-filter-field-label">
              <span>Зона</span>
              <FilterSearchableSelect
                emptyLabel="Все"
                className={territorySelectClass}
                value={d.zoneFilter}
                onValueChange={(v) => patchDraft(onDraftChange, { zoneFilter: v })}
                options={territoryCascade.zones}
                closeToken={territorySelectCloseTok}
                onOpenChange={(open) => {
                  if (open) bumpTerritoryClose();
                }}
                minPopoverWidth={240}
              />
            </div>
            <div className="orders-filter-field-label">
              <span>Область</span>
              <FilterSearchableSelect
                emptyLabel="Все"
                className={territorySelectClass}
                value={d.regionFilter}
                onValueChange={(v) => patchDraft(onDraftChange, { regionFilter: v })}
                options={territoryCascade.regions}
                closeToken={territorySelectCloseTok}
                onOpenChange={(open) => {
                  if (open) bumpTerritoryClose();
                }}
                minPopoverWidth={260}
              />
            </div>
            <div className="orders-filter-field-label">
              <span>Город</span>
              <FilterSearchableSelect
                emptyLabel="Все"
                className={territorySelectClass}
                value={d.cityFilter}
                onValueChange={(v) => patchDraft(onDraftChange, { cityFilter: v })}
                options={territoryCascade.cities}
                closeToken={territorySelectCloseTok}
                onOpenChange={(open) => {
                  if (open) bumpTerritoryClose();
                }}
                minPopoverWidth={260}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              size="sm"
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => onApplyToolbar()}
            >
              Применить
            </Button>
          </div>

          <DateRangePopover
            open={dateRangeOpen}
            onOpenChange={setDateRangeOpen}
            anchorRef={dateRangeAnchorRef}
            dateFrom={d.createdFrom}
            dateTo={d.createdTo}
            onApply={({ dateFrom, dateTo }) => {
              patchDraft(onDraftChange, { createdFrom: dateFrom, createdTo: dateTo });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientsTableListToolbarStrip({
  search,
  onSearchChange,
  pageLimit,
  onPageLimitChange,
  onOpenColumnSettings,
  totalRecords
}: ClientsTableListToolbarStripProps) {
  return (
    <div
      className="table-toolbar orders-hub-section--toolbar flex flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4"
      role="toolbar"
      aria-label="Таблица: поиск и колонки"
    >
      <label className="grid shrink-0 gap-1 text-xs font-medium text-foreground/85">
        <span className="whitespace-nowrap leading-none">На стр.</span>
        <select
          className="h-9 min-w-[4.5rem] rounded-md border border-input bg-background px-2 text-sm font-medium text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={pageLimit}
          onChange={(e) => onPageLimitChange(Number(e.target.value))}
        >
          {[10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="relative flex min-w-[200px] flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Поиск: наименование, телефон, ИНН, ПИНФЛ, адрес…"
          className="h-9 border pl-9 font-medium text-foreground"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1 font-semibold"
        onClick={onOpenColumnSettings}
        title="Колонки (порядок и видимость)"
      >
        <ListOrdered className="h-4 w-4" />
        Колонки
      </Button>
      {totalRecords != null ? (
        <span className="ml-auto self-end pb-0.5 text-sm text-foreground/80">
          Всего записей:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatNumberGrouped(totalRecords, { maxFractionDigits: 0 })}
          </span>
        </span>
      ) : null}
    </div>
  );
}
