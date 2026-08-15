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

export function NumberRangeFilter({ fieldLabel, fieldId, filter, onApply, onClose }: Props) {
  const f = getPivotStrings().filters;
  const [min, setMin] = useState(filter?.range?.min?.toString() ?? "");
  const [max, setMax] = useState(filter?.range?.max?.toString() ?? "");

  function handleApply() {
    const minN = min === "" ? undefined : Number(min);
    const maxN = max === "" ? undefined : Number(max);
    if (minN === undefined && maxN === undefined) {
      onApply(null);
      onClose();
      return;
    }
    onApply({
      fieldId,
      type: "range",
      range: {
        min: minN !== undefined && Number.isFinite(minN) ? minN : undefined,
        max: maxN !== undefined && Number.isFinite(maxN) ? maxN : undefined
      }
    });
    onClose();
  }

  return (
    <div className="w-52 space-y-2 rounded-md border border-border bg-popover p-3 shadow-md">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{f.min}</span>
        <Input
          type="number"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="h-8 text-xs"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{f.max}</span>
        <Input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="h-8 text-xs"
        />
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
