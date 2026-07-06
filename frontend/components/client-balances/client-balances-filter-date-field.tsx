"use client";

import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import { cn } from "@/lib/utils";
import { CalendarDays, X } from "lucide-react";
import { useRef, useState } from "react";

export function FilterDateField({
  label,
  value,
  onChange,
  compact = false
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  compact?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.trim());
  const displayDate = hasValue ? formatRuDateButton(value) : "";

  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="shrink-0 overflow-visible pt-2.5">
      <button
        ref={anchorRef}
        type="button"
        title={label}
        className={cn(
          "relative flex w-full cursor-pointer items-center justify-between gap-1 border bg-card text-left transition-colors focus:outline-none dark:bg-background",
          compact ? "h-[38px] min-w-[10.5rem] rounded-md px-2.5" : "h-[38px] min-w-[10.5rem] max-w-[14rem] rounded-lg px-3",
          open ? "border-emerald-400 ring-1 ring-emerald-200" : "border-border hover:border-border dark:border-input"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={cn(
            "pointer-events-none absolute max-w-[calc(100%-2.25rem)] truncate bg-card leading-none transition-all duration-200 dark:bg-background",
            hasValue
              ? compact
                ? "left-1.5 top-0 -translate-y-1/2 px-0.5 text-[10px] font-medium text-gray-600"
                : "left-2 top-0 -translate-y-1/2 px-1 text-[11px] font-medium text-gray-600"
              : compact
                ? "left-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-600"
                : "left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-gray-600"
          )}
        >
          {label}
        </span>
        {displayDate ? (
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium text-gray-900",
              compact ? "ml-0.5 pt-px text-[11px]" : "ml-1 pt-0.5 text-[13px]"
            )}
          >
            {displayDate}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {hasValue ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3 text-gray-500" />
            </span>
          ) : null}
          <CalendarDays className={cn("shrink-0 text-gray-500", compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5")} />
        </div>
      </button>
      <DatePickerPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef as React.RefObject<HTMLElement | null>}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
