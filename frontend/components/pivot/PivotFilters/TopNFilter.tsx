"use client";

import { useState } from "react";
import type { PivotField, PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  field: PivotField;
  measureFields: PivotField[];
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
};

export function TopNFilter({ field, measureFields, filter, onApply, onClose }: Props) {
  const f = getPivotStrings().filters;
  const [mode, setMode] = useState<"top_n" | "bottom_n">(
    filter?.type === "bottom_n" ? "bottom_n" : "top_n"
  );
  const [topN, setTopN] = useState(String(filter?.topN ?? 5));
  const [measureFieldId, setMeasureFieldId] = useState(filter?.measureFieldId ?? "");

  function handleApply() {
    const n = Number(topN);
    if (!Number.isFinite(n) || n <= 0) {
      onApply(null);
      onClose();
      return;
    }

    onApply({
      fieldId: field.id,
      type: mode,
      topN: Math.floor(n),
      ...(measureFieldId ? { measureFieldId } : {})
    });
    onClose();
  }

  return (
    <div className="w-64 space-y-2 rounded-md border border-border bg-popover p-3 shadow-md">
      <div className="text-xs font-semibold">{field.label} — {f.topN}</div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "top_n" ? "default" : "outline"}
          className="h-7 flex-1 text-[10px]"
          onClick={() => setMode("top_n")}
        >
          {f.topHighest}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "bottom_n" ? "default" : "outline"}
          className="h-7 flex-1 text-[10px]"
          onClick={() => setMode("bottom_n")}
        >
          {f.topLowest}
        </Button>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">{f.nValue}</label>
        <Input
          type="number"
          min={1}
          value={topN}
          onChange={(e) => setTopN(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      {measureFields.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">{f.metricOptional}</label>
          <select
            value={measureFieldId}
            onChange={(e) => setMeasureFieldId(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">{f.rowCount}</option>
            {measureFields.map((measure) => (
              <option key={measure.id} value={measure.id}>
                {measure.label}
              </option>
            ))}
          </select>
        </div>
      )}
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
