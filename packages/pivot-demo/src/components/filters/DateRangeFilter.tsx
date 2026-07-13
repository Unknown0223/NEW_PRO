import { useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";

type Props = {
  fieldLabel: string;
  fieldId: string;
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
};

export function DateRangeFilter({ fieldLabel, fieldId, filter, onApply, onClose }: Props) {
  const f = getPivotStrings().filters;
  const [from, setFrom] = useState(filter?.dateRange?.from?.toISOString().slice(0, 10) ?? "");
  const [to, setTo] = useState(filter?.dateRange?.to?.toISOString().slice(0, 10) ?? "");

  return (
    <div className="w-56 space-y-2 rounded-md border bg-white p-3 shadow-lg">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <label className="block text-xs">
        {f.from}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-8 w-full rounded border px-2" />
      </label>
      <label className="block text-xs">
        {f.to}
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-8 w-full rounded border px-2" />
      </label>
      <div className="flex justify-end gap-1 border-t pt-2">
        <button type="button" className="text-xs" onClick={onClose}>
          {f.cancel}
        </button>
        <button
          type="button"
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
          onClick={() => {
            if (!from && !to) onApply(null);
            else {
              onApply({
                fieldId,
                type: "date_range",
                dateRange: {
                  from: from ? new Date(`${from}T00:00:00`) : undefined,
                  to: to ? new Date(`${to}T23:59:59`) : undefined
                }
              });
            }
            onClose();
          }}
        >
          {f.apply}
        </button>
      </div>
    </div>
  );
}
