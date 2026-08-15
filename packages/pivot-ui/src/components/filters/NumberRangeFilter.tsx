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

export function NumberRangeFilter({ fieldLabel, fieldId, filter, onApply, onClose }: Props) {
  const f = getPivotStrings().filters;
  const [min, setMin] = useState(filter?.range?.min?.toString() ?? "");
  const [max, setMax] = useState(filter?.range?.max?.toString() ?? "");

  return (
    <div className="w-52 space-y-2 rounded-md border bg-white p-3 shadow-lg">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <label className="block text-xs">
        {f.min}
        <input type="number" value={min} onChange={(e) => setMin(e.target.value)} className="mt-1 h-8 w-full rounded border px-2" />
      </label>
      <label className="block text-xs">
        {f.max}
        <input type="number" value={max} onChange={(e) => setMax(e.target.value)} className="mt-1 h-8 w-full rounded border px-2" />
      </label>
      <div className="flex justify-end gap-1 border-t pt-2">
        <button type="button" className="text-xs" onClick={onClose}>
          {f.cancel}
        </button>
        <button
          type="button"
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
          onClick={() => {
            if (!min && !max) onApply(null);
            else {
              onApply({
                fieldId,
                type: "range",
                range: {
                  min: min ? Number(min) : undefined,
                  max: max ? Number(max) : undefined
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
