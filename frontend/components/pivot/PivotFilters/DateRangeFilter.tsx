"use client";

import { useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  fieldLabel: string;
  fieldId: string;
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
};

function toInputDate(d?: Date): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function DateRangeFilter({ fieldLabel, fieldId, filter, onApply, onClose }: Props) {
  const f = getPivotStrings().filters;
  const [from, setFrom] = useState(toInputDate(filter?.dateRange?.from));
  const [to, setTo] = useState(toInputDate(filter?.dateRange?.to));

  function handleApply() {
    if (!from && !to) {
      onApply(null);
      onClose();
      return;
    }
    onApply({
      fieldId,
      type: "date_range",
      dateRange: {
        from: from ? new Date(`${from}T00:00:00`) : undefined,
        to: to ? new Date(`${to}T23:59:59`) : undefined
      }
    });
    onClose();
  }

  return (
    <div className="w-56 space-y-2 rounded-md border border-border bg-popover p-3 shadow-md">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{f.from}</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{f.to}</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
      </label>
      <div className="flex justify-end gap-1 border-t border-border pt-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
          {f.cancel}
        </Button>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={handleApply}>
          {f.apply}
        </Button>
      </div>
    </div>
  );
}
