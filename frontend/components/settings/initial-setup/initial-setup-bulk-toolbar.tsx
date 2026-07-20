"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { StepTableColumn } from "@/lib/initial-setup/ref-table-config";
import type { RelationOption, RelationOptionsMap } from "@/lib/initial-setup/relation-options";
import { INPUT_SURFACE_CLASS } from "@/lib/ui-input-styles";

const FIELD_CLASS =
  "h-8 min-w-0 w-full rounded-lg border-slate-200 bg-white text-xs shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

function BulkRelationSelect({
  value,
  options,
  placeholder,
  onChange
}: {
  value: string;
  options: RelationOption[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className={cn(
        INPUT_SURFACE_CLASS,
        FIELD_CLASS,
        "appearance-none bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{options.length ? `— ${placeholder} —` : "Ma’lumot yo‘q"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type Props = {
  selectedCount: number;
  totalCount: number;
  columns: StepTableColumn[];
  relationOptionsMap: RelationOptionsMap;
  draft: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
  onApplyColumn: (key: string) => void;
  onClear: () => void;
  enabled: boolean;
};

/** Pastki panel: tanlangan qatorlarga umumiy qiymat qo‘llash */
export function InitialSetupBulkToolbar({
  selectedCount,
  totalCount,
  columns,
  relationOptionsMap,
  draft,
  onDraftChange,
  onApplyColumn,
  onClear,
  enabled
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || selectedCount <= 0) return null;

  const editableCols = columns.filter((c) => c.key !== "_id" && c.relation);
  if (editableCols.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex justify-center px-3 sm:px-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Массовое редактирование"
        className="pointer-events-auto w-full max-w-4xl rounded-xl border border-border/80 bg-card shadow-lg ring-1 ring-teal-600/15"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2 sm:px-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={onClear}
            aria-label="Снять выделение"
            title="Снять выделение"
          >
            <X className="size-3.5" />
          </Button>
          <p className="min-w-0 text-xs text-muted-foreground sm:text-sm">
            <span className="font-semibold tabular-nums text-foreground">{selectedCount}</span>
            <span> выбрано из </span>
            <span className="font-semibold tabular-nums text-foreground">{totalCount}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">Заполните поле и нажмите «Применить»</p>
        </div>

        <div className="grid max-h-[40vh] gap-3 overflow-auto p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {editableCols.map((col) => {
            const value = draft[col.key] ?? "";
            const opts = col.relation ? relationOptionsMap[col.relation] ?? [] : [];
            return (
              <div key={col.key} className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                <p className="text-[11px] font-medium text-foreground">{col.header.replace(/\s*\*$/, "")}</p>
                {col.relation ? (
                  <BulkRelationSelect
                    value={value}
                    options={opts}
                    placeholder={col.header.replace(/\s*\*$/, "")}
                    onChange={(v) => onDraftChange(col.key, v)}
                  />
                ) : (
                  <Input
                    type={col.numeric ? "number" : "text"}
                    maxFractionDigits={col.maxFractionDigits ?? 6}
                    allowNegative={false}
                    className={FIELD_CLASS}
                    value={value}
                    disabled={!enabled}
                    placeholder={col.header.replace(/\s*\*$/, "")}
                    onChange={(e) => onDraftChange(col.key, e.target.value)}
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 w-full text-[11px]"
                  disabled={!enabled || !value.trim()}
                  onClick={() => onApplyColumn(col.key)}
                >
                  Применить
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
