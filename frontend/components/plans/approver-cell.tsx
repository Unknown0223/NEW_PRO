"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterSelectOptions } from "./approver-used-options";
import { SearchableSelect } from "./searchable-select";
import type { ApproverPerson } from "./approvers-api";

const ROUND_BTN =
  "absolute z-20 flex items-center justify-center rounded-full border bg-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100";
const ADD_BTN = "border-teal-500 text-teal-600 hover:bg-teal-50";
const DEL_BTN = "border-red-400 text-red-500 hover:bg-red-50";

/** Zanjirdagi bitta bosqich katagi (Степень N) — xodim tanlash + qo'shish/o'chirish. */
export function LevelCell({
  value,
  employees,
  excludeIds,
  canWrite,
  canRemove,
  nameOf,
  onChange,
  onAddBefore,
  onAddAfter,
  onRemove
}: {
  value: number | null;
  employees: ApproverPerson[];
  excludeIds: number[];
  canWrite: boolean;
  canRemove: boolean;
  nameOf: (id: number) => string;
  onChange: (value: number | null) => void;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onRemove: () => void;
}) {
  const cellOptions = filterSelectOptions(employees, value, excludeIds);
  return (
    <div className="group relative flex items-center">
      {canWrite && (
        <button type="button" onClick={onAddBefore} title="Добавить степень слева" className={cn(ROUND_BTN, ADD_BTN, "-left-2 top-1/2 size-5 -translate-y-1/2")}>
          <Plus className="size-3.5" />
        </button>
      )}
      <SearchableSelect
        value={value}
        options={cellOptions}
        onChange={onChange}
        nameOf={nameOf}
        disabled={!canWrite}
        menuWidth={260}
      />
      {canWrite && (
        <button type="button" onClick={onAddAfter} title="Добавить степень справа" className={cn(ROUND_BTN, ADD_BTN, "-right-2 top-1/2 size-5 -translate-y-1/2")}>
          <Plus className="size-3.5" />
        </button>
      )}
      {canWrite && canRemove && (
        <button type="button" onClick={onRemove} title="Удалить степень" className={cn(ROUND_BTN, DEL_BTN, "-bottom-2.5 left-1/2 size-[18px] -translate-x-1/2")}>
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/** Ustun sarlavhasi — butun ustunga xodim qo'llash + ustun qo'shish/o'chirish. */
export function HeaderCell({
  label,
  columnValue,
  employees,
  excludeIds,
  canWrite,
  canRemove,
  nameOf,
  onApplyAll,
  onAddBefore,
  onAddAfter,
  onRemove
}: {
  label: string;
  columnValue: number | null;
  employees: ApproverPerson[];
  excludeIds: number[];
  canWrite: boolean;
  canRemove: boolean;
  nameOf: (id: number) => string;
  onApplyAll: (value: number) => void;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onRemove: () => void;
}) {
  const headerOptions = filterSelectOptions(employees, columnValue, excludeIds);
  return (
    <div className="group relative flex w-full items-center justify-center">
      {canWrite && (
        <button type="button" onClick={onAddBefore} title="Добавить столбец слева" className={cn(ROUND_BTN, ADD_BTN, "-left-1.5 top-1/2 size-[18px] -translate-y-1/2")}>
          <Plus className="size-3" />
        </button>
      )}
      <SearchableSelect
        value={columnValue}
        options={headerOptions}
        onChange={onApplyAll}
        nameOf={nameOf}
        disabled={!canWrite}
        placeholder={label}
        menuWidth={260}
        triggerClassName={cn(
          "h-8 text-[11px] font-semibold",
          columnValue == null && "border-transparent bg-transparent text-muted-foreground hover:bg-background"
        )}
      />
      {canWrite && (
        <button type="button" onClick={onAddAfter} title="Добавить столбец справа" className={cn(ROUND_BTN, ADD_BTN, "-right-1.5 top-1/2 size-[18px] -translate-y-1/2")}>
          <Plus className="size-3" />
        </button>
      )}
      {canWrite && canRemove && (
        <button type="button" onClick={onRemove} title="Удалить столбец" className={cn(ROUND_BTN, DEL_BTN, "-bottom-2.5 left-1/2 size-4 -translate-x-1/2")}>
          <X className="size-2.5" />
        </button>
      )}
    </div>
  );
}
