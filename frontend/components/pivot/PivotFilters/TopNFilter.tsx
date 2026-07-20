"use client";

import { useState } from "react";
import type { PivotField, PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DemoApplyButton, DemoCancelButton } from "@/components/reports/demo-dialog-actions";
import { FILTER_PANEL as C } from "./filter-panel-chrome";

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
    <div
      className="w-[320px] overflow-hidden rounded-sm shadow-xl"
      style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.headerBg }}
      >
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          {field.label} — {f.topN}
        </div>
        <DemoApplyButton onClick={handleApply}>{f.apply}</DemoApplyButton>
        <DemoCancelButton onClick={onClose}>{f.cancel}</DemoCancelButton>
      </div>
      <div className="space-y-2.5 px-3 py-3" style={{ background: C.bg }}>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "top_n" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onClick={() => setMode("top_n")}
          >
            {f.topHighest}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "bottom_n" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onClick={() => setMode("bottom_n")}
          >
            {f.topLowest}
          </Button>
        </div>
        <div className="space-y-1">
          <label className="text-[11px]" style={{ color: C.muted }}>
            {f.nValue}
          </label>
          <Input
            type="number"
            min={1}
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
            className="h-8 rounded-sm text-xs"
            style={{ borderColor: C.border, background: C.bg, color: C.text }}
          />
        </div>
        {measureFields.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px]" style={{ color: C.muted }}>
              {f.metricOptional}
            </label>
            <select
              value={measureFieldId}
              onChange={(e) => setMeasureFieldId(e.target.value)}
              className="h-8 w-full rounded-sm px-2 text-xs"
              style={{ border: `1px solid ${C.border}`, background: C.bg, color: C.text }}
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
      </div>
    </div>
  );
}
