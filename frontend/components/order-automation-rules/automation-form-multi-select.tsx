"use client";

import { WorkSlotsMultiSelect } from "@/components/work-slots/work-slots-multi-select";
import { cn } from "@/lib/utils";

const FORM_TRIGGER =
  "h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm font-normal text-gray-700 shadow-sm hover:border-gray-300";

type Props = {
  label: string;
  placeholder?: string;
  items: { id: string; title: string }[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

export function AutomationFormMultiSelect({
  label,
  placeholder,
  items,
  selectedValues,
  onChange,
  multiple = true,
  disabled,
  loading
}: Props) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <WorkSlotsMultiSelect
        variant="form"
        placeholder={loading ? "Загрузка…" : (placeholder ?? label)}
        items={items}
        selectedValues={selectedValues}
        onChange={onChange}
        multiple={multiple}
        disabled={disabled || loading || items.length === 0}
        triggerClassName={cn(FORM_TRIGGER, loading && "animate-pulse text-gray-400")}
      />
    </div>
  );
}
