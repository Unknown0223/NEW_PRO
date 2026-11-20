"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { cn } from "@/lib/utils";
import type { FlatReportDateRangeField } from "./types";

type Props = {
  field: FlatReportDateRangeField;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
};

/** One labeled date-range picker (supports dual A/B via multiple fields). */
export function DateRangeFieldControl({ field, from, to, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {field.label ? <span className="text-xs text-muted-foreground">{field.label}</span> : null}
      <button
        ref={anchorRef}
        type="button"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs",
          open && "border-primary/60 bg-primary/5"
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        <span>{formatDateRangeButton(from, to)}</span>
      </button>
      <DateRangePopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        dateFrom={from}
        dateTo={to}
        onApply={({ dateFrom, dateTo }) => onApply(dateFrom, dateTo)}
      />
    </>
  );
}
