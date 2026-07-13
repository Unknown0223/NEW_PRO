"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import type { ClientToolbarFiltersState } from "@/lib/client-list-toolbar-filters";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { cn } from "@/lib/utils";
import { ClientsListSearchInput } from "@/components/clients/clients-list-search-input";
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Layers, ListOrdered, RefreshCw, RotateCcw } from "lucide-react";
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
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Jadval kartochkasi ichida — pastki border bilan ajratiladi */
  totalRecords?: number;
};

type FiltersProps = {
  draft: ClientToolbarFiltersState;
  onDraftChange: (patch: Partial<ClientToolbarFiltersState>) => void;
  onApplyToolbar: () => void;
  onResetToolbar?: () => void;
  onDateRangeApplied?: (dateFrom: string, dateTo: string) => void;
  categorySelectOptions: RefSelectOption[];
  equipmentSelectOptions?: RefSelectOption[];
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
  onResetToolbar,
  onDateRangeApplied,
  categorySelectOptions,
  equipmentSelectOptions = [],
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
            {equipmentSelectOptions.length > 0 ? (
              <label className="orders-filter-field-label">
                Оборудование
                <select
                  className={filterPanelSelectClassName}
                  value={d.equipmentKindFilter}
                  onChange={(e) => patchDraft(onDraftChange, { equipmentKindFilter: e.target.value })}
                >
                  <option value="">Все</option>
                  {equipmentSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
            {onResetToolbar ? (
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={onResetToolbar}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Сброс
              </Button>
            ) : null}
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
              if (onDateRangeApplied) {
                onDateRangeApplied(dateFrom, dateTo);
              } else {
                patchDraft(onDraftChange, { createdFrom: dateFrom, createdTo: dateTo });
              }
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
  onRefresh,
  refreshing = false,
  totalRecords
}: ClientsTableListToolbarStripProps) {
  return (
    <div
      className="table-toolbar orders-hub-section--toolbar flex flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4"
      role="toolbar"
      aria-label="Таблица: поиск и колонки"
    >
      <label className="grid shrink-0 gap-1 text-xs font-semibold text-foreground">
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
      <ClientsListSearchInput value={search} onChange={onSearchChange} />
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
      {onRefresh ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={onRefresh}
          disabled={refreshing}
          title="Обновить"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
        </Button>
      ) : null}
      {totalRecords != null ? (
        <span className="ml-auto self-end pb-0.5 text-sm text-foreground">
          Всего записей:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatNumberGrouped(totalRecords, { maxFractionDigits: 0 })}
          </span>
        </span>
      ) : null}
    </div>
  );
}

export function ClientsTemplateListToolbar({
  search,
  onSearchChange,
  pageLimit,
  onPageLimitChange,
  onOpenColumnSettings,
  onRefresh,
  refreshing = false,
  onResetView,
  onImportUpdate,
  onImportCreate,
  importDisabled = false,
  onExportExcel,
  onGroupProcessing,
  groupProcessingDisabled = false
}: {
  search: string;
  onSearchChange: (v: string) => void;
  pageLimit: number;
  onPageLimitChange: (v: number) => void;
  onOpenColumnSettings: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onResetView?: () => void;
  onImportUpdate: () => void;
  onImportCreate: () => void;
  importDisabled?: boolean;
  onExportExcel?: () => void;
  /** Belgilangan klientlar bo‘yicha guruh ishlov modalini ochish */
  onGroupProcessing?: () => void;
  groupProcessingDisabled?: boolean;
}) {
  const toolbarBtn =
    "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50";

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold text-gray-800">Список клиентов</h3>

      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
        role="toolbar"
        aria-label="Список клиентов: поиск и действия"
      >
        <div className="flex shrink-0 items-center gap-0.5">
          {onResetView ? (
            <button
              type="button"
              onClick={onResetView}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
              title="Сбросить"
            >
              <RotateCcw className="h-4 w-4 text-gray-600" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenColumnSettings}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            title="Колонки"
          >
            <ListOrdered className="h-4 w-4 text-gray-600" />
          </button>
          <select
            className="h-8 cursor-pointer rounded-md border-none bg-transparent pr-6 text-xs font-semibold text-gray-800 focus:ring-0"
            value={pageLimit}
            onChange={(e) => onPageLimitChange(Number(e.target.value))}
            aria-label="Строк на странице"
          >
            {[10, 15, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="mx-1 hidden h-5 w-px shrink-0 bg-muted md:block" />

        <ClientsListSearchInput value={search} onChange={onSearchChange} className="min-w-[9rem] flex-1" />

        <div className="mx-1 hidden h-5 w-px shrink-0 bg-muted lg:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={importDisabled}
            onClick={onImportUpdate}
            className={toolbarBtn}
          >
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
            Обновление клиентов с Excel
          </button>
          <button type="button" disabled={importDisabled} onClick={onImportCreate} className={toolbarBtn}>
            <Download className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
            Импорт
          </button>
          {onGroupProcessing ? (
            <button
              type="button"
              disabled={groupProcessingDisabled}
              onClick={onGroupProcessing}
              className={toolbarBtn}
              title={groupProcessingDisabled ? "Avval klientlarni belgilang" : undefined}
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />
              Групповые обработки
            </button>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {onExportExcel ? (
            <button
              type="button"
              onClick={onExportExcel}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-muted disabled:opacity-50"
              title="Обновить список"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** @deprecated ClientsTemplateListToolbar ishlating */
export function ClientsTableSectionHeader({
  onImportUpdate,
  onImportCreate,
  importDisabled = false,
  onGroupProcessing,
  groupProcessingDisabled = false
}: {
  onImportUpdate: () => void;
  onImportCreate: () => void;
  importDisabled?: boolean;
  onGroupProcessing?: () => void;
  groupProcessingDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-xl font-bold tracking-tight text-gray-800">Список клиенты</h3>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={importDisabled}
          onClick={onImportUpdate}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" aria-hidden />
          Обновление клиентов с Excel
        </button>
        <button
          type="button"
          disabled={importDisabled}
          onClick={onImportCreate}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-4 w-4 text-gray-600" aria-hidden />
          Импорт
        </button>
        {onGroupProcessing ? (
          <button
            type="button"
            disabled={groupProcessingDisabled}
            onClick={onGroupProcessing}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
          >
            <Layers className="h-4 w-4 text-gray-600" aria-hidden />
            Групповые обработки
          </button>
        ) : null}
      </div>
    </div>
  );
}

function buildPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (page > 3) pages.push("...");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export function ClientsListPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3">
      <div className="text-sm text-gray-600">
        Показано{" "}
        <span className="font-medium text-gray-900">
          {start} – {end}
        </span>{" "}
        / <span className="font-medium text-gray-900">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="flex h-8 w-8 items-center justify-center text-sm text-gray-600">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded border text-sm font-medium transition-colors",
                page === p
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border text-gray-600 hover:bg-muted"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
