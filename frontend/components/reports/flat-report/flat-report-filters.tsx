"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { FileSpreadsheet, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import type { FlatReportConfig, FlatReportFilterField, FlatReportSelectField } from "./types";
import { mapSelectOptions, type DraftState, type MultiItem } from "./flat-report-helpers";
import { DateRangeFieldControl } from "./date-range-field";
import { MultiFilter } from "./multi-filter";
import { BandsFilter } from "./bands-filter";

type Props = {
  config: FlatReportConfig;
  draft: DraftState;
  setDraft: Dispatch<SetStateAction<DraftState>>;
  filterOptions: Record<string, unknown> | undefined;
  multiItemsByKey: Record<string, MultiItem[]>;
  dateTypeField: FlatReportSelectField | undefined;
  dateTypeAsRadio: boolean;
  dateTypeOptions: Array<{ id: string; label: string }>;
  canExport: boolean;
  exporting: boolean;
  fetching: boolean;
  onReset: () => void;
  onApply: () => void;
  onExport: () => void;
};

function renderGridField(
  field: FlatReportFilterField,
  draft: DraftState,
  setDraft: Dispatch<SetStateAction<DraftState>>,
  filterOptions: Record<string, unknown> | undefined,
  multiItemsByKey: Record<string, MultiItem[]>,
  onApply: () => void,
  openMultiKey: string | null,
  setOpenMultiKey: (key: string | null) => void
) {
  if (field.kind === "select") {
    const options =
      field.staticOptions ??
      mapSelectOptions(field.optionsFrom ? filterOptions?.[field.optionsFrom] : undefined);
    const name = field.placeholder?.trim() || undefined;
    return (
      <div key={field.paramKey} className="relative min-w-0">
        {name ? (
          <span className="pointer-events-none absolute left-1.5 top-0 z-[1] -translate-y-1/2 bg-card px-1 text-[11px] font-medium leading-none text-muted-foreground">
            {name}
          </span>
        ) : null}
        <select
          className={cn(
            filterSelectClassName,
            "h-8 min-w-0 max-w-none w-full px-1.5 text-xs",
            name && "pt-1"
          )}
          aria-label={name}
          value={String(draft[field.paramKey] ?? field.defaultValue)}
          onChange={(e) => setDraft((d) => ({ ...d, [field.paramKey]: e.target.value }))}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.kind === "multiSelect") {
    const selected = Array.isArray(draft[field.paramKey])
      ? (draft[field.paramKey] as string[])
      : [];
    return (
      <MultiFilter
        key={field.paramKey}
        placeholder={field.placeholder}
        items={multiItemsByKey[field.paramKey] ?? []}
        selectedValues={selected}
        onChange={(v) => setDraft((d) => ({ ...d, [field.paramKey]: v }))}
        compact
        open={openMultiKey === field.paramKey}
        onOpenChange={(open) => setOpenMultiKey(open ? field.paramKey : null)}
      />
    );
  }
  if (field.kind === "search") {
    const key = field.paramKey ?? "search";
    return (
      <div key={key} className="relative min-w-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-7 text-xs"
          value={String(draft[key] ?? "")}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
          placeholder={field.placeholder}
        />
      </div>
    );
  }
  if (field.kind !== "bands") return null;
  const bandsKey = field.paramKey ?? "bands";
  return (
    <BandsFilter
      key={bandsKey}
      label={field.placeholder?.trim() || "Пороги"}
      value={String(draft[bandsKey] ?? "")}
      onChange={(v) => setDraft((d) => ({ ...d, [bandsKey]: v }))}
      compact
      open={openMultiKey === bandsKey}
      onOpenChange={(open) => setOpenMultiKey(open ? bandsKey : null)}
    />
  );
}

/**
 * Yuqori qator: sana radios + date range + actions (joyida qoladi).
 * Pastki qator: qolgan filtrlar — `filterGridCols: 9` da bitta qator.
 */
export function FlatReportFilters({
  config,
  draft,
  setDraft,
  filterOptions,
  multiItemsByKey,
  dateTypeField,
  dateTypeAsRadio,
  dateTypeOptions,
  canExport,
  exporting,
  fetching,
  onReset,
  onApply,
  onExport
}: Props) {
  const [openMultiKey, setOpenMultiKey] = useState<string | null>(null);

  const gridFields = config.filterFields.filter((field) => {
    if (field.kind === "dateRange") return false;
    if (field.kind === "select" && field.paramKey === "date_type" && dateTypeAsRadio) return false;
    return (
      field.kind === "select" ||
      field.kind === "multiSelect" ||
      field.kind === "search" ||
      field.kind === "bands"
    );
  });
  /** 9 → pastki filtrlar bitta qator (md+). */
  const oneFilterRow = config.filterGridCols === 9;

  const actions = (
    <div className="flex shrink-0 justify-end gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
      {canExport ? (
        <Button
          variant="outline"
          className="h-8 text-xs"
          disabled={exporting || fetching}
          onClick={onExport}
        >
          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
          Excel
        </Button>
      ) : null}
      <Button className="h-8 text-xs" onClick={onApply}>
        Применить
      </Button>
    </div>
  );

  return (
    <div className="space-y-2 rounded border bg-card p-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {dateTypeAsRadio && dateTypeField ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Дата применяется по</span>
            {dateTypeOptions.map((dt) => (
              <label key={dt.id} className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  className="accent-primary"
                  checked={String(draft.date_type ?? dateTypeField.defaultValue) === dt.id}
                  onChange={() => setDraft((d) => ({ ...d, date_type: dt.id }))}
                />
                {dt.label}
              </label>
            ))}
          </div>
        ) : null}
        {config.filterFields.map((field) => {
          if (field.kind !== "dateRange") return null;
          const fromKey = field.fromKey ?? "from";
          const toKey = field.toKey ?? "to";
          return (
            <DateRangeFieldControl
              key={`${fromKey}-${toKey}`}
              field={field}
              from={String(draft[fromKey] ?? "")}
              to={String(draft[toKey] ?? "")}
              onApply={(dateFrom, dateTo) =>
                setDraft((d) => ({ ...d, [fromKey]: dateFrom, [toKey]: dateTo }))
              }
            />
          );
        })}
        {actions}
      </div>

      {gridFields.length > 0 ? (
        oneFilterRow ? (
          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto overflow-y-visible pt-2.5 pb-1">
            {gridFields.map((field) => {
              const key =
                "paramKey" in field ? String(field.paramKey ?? field.kind) : field.kind;
              return (
                <div key={key} className="w-[9.5rem] shrink-0">
                  {renderGridField(
                    field,
                    draft,
                    setDraft,
                    filterOptions,
                    multiItemsByKey,
                    onApply,
                    openMultiKey,
                    setOpenMultiKey
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 pt-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-6">
            {gridFields.map((field) =>
              renderGridField(
                field,
                draft,
                setDraft,
                filterOptions,
                multiItemsByKey,
                onApply,
                openMultiKey,
                setOpenMultiKey
              )
            )}
          </div>
        )
      ) : null}
    </div>
  );
}
