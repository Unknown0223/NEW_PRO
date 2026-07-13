import { useState } from "react";
import type { PivotField, PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";

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

  const btn = (active: boolean) =>
    `h-7 flex-1 rounded-md border px-2 text-[10px] ${
      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"
    }`;

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
    <div className="w-64 space-y-2 rounded-md border border-zinc-200 bg-white p-3 shadow-md">
      <div className="text-xs font-semibold">{field.label} — {f.topN}</div>
      <div className="flex gap-1">
        <button type="button" className={btn(mode === "top_n")} onClick={() => setMode("top_n")}>
          {f.topHighest}
        </button>
        <button
          type="button"
          className={btn(mode === "bottom_n")}
          onClick={() => setMode("bottom_n")}
        >
          {f.topLowest}
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">{f.nValue}</label>
        <input
          type="number"
          min={1}
          value={topN}
          onChange={(e) => setTopN(e.target.value)}
          className="h-8 w-full rounded-md border border-zinc-300 px-2 text-xs"
        />
      </div>
      {measureFields.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500">{f.metricOptional}</label>
          <select
            value={measureFieldId}
            onChange={(e) => setMeasureFieldId(e.target.value)}
            className="h-8 w-full rounded-md border border-zinc-300 px-2 text-xs"
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
      <div className="flex justify-end gap-1 border-t border-zinc-200 pt-2">
        <button type="button" className="h-7 px-2 text-xs text-zinc-600" onClick={onClose}>
          {f.cancel}
        </button>
        <button
          type="button"
          className="h-7 rounded-md bg-zinc-900 px-2 text-xs text-white"
          onClick={handleApply}
        >
          {f.apply}
        </button>
      </div>
    </div>
  );
}
