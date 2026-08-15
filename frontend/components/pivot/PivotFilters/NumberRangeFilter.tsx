"use client";

import { useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Input } from "@/components/ui/input";
import { DemoApplyButton, DemoCancelButton } from "@/components/reports/demo-dialog-actions";
import { FILTER_PANEL as C } from "./filter-panel-chrome";

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
    <div
      className="w-[280px] overflow-hidden rounded-sm shadow-xl"
      style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.headerBg }}
      >
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{fieldLabel}</div>
        <DemoApplyButton onClick={handleApply}>{f.apply}</DemoApplyButton>
        <DemoCancelButton onClick={onClose}>{f.cancel}</DemoCancelButton>
      </div>
      <div className="space-y-2.5 px-3 py-3" style={{ background: C.bg }}>
        <label className="block space-y-1">
          <span className="text-[11px]" style={{ color: C.muted }}>
            {f.min}
          </span>
          <Input
            type="number"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-8 rounded-sm text-xs"
            style={{ borderColor: C.border, background: C.bg, color: C.text }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px]" style={{ color: C.muted }}>
            {f.max}
          </span>
          <Input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-8 rounded-sm text-xs"
            style={{ borderColor: C.border, background: C.bg, color: C.text }}
          />
        </label>
      </div>
    </div>
  );
}
