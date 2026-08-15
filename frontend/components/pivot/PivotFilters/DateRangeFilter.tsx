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
            {f.from}
          </span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 rounded-sm text-xs"
            style={{ borderColor: C.border, background: C.bg, color: C.text }}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px]" style={{ color: C.muted }}>
            {f.to}
          </span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 rounded-sm text-xs"
            style={{ borderColor: C.border, background: C.bg, color: C.text }}
          />
        </label>
      </div>
    </div>
  );
}
