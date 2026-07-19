import { useMemo, useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";

type Props = {
  fieldLabel: string;
  members: (string | number)[];
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
  onTopN?: () => void;
};

export function MultiSelectFilter({ fieldLabel, members, filter, onApply, onClose, onTopN }: Props) {
  const f = getPivotStrings().filters;
  const [mode, setMode] = useState<"include" | "exclude">(
    filter?.type === "exclude" ? "exclude" : "include"
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(filter?.values?.map(String) ?? [])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => String(m).toLowerCase().includes(q));
  }, [members, search]);

  return (
    <div className="w-64 space-y-2 rounded-md border bg-white p-3 shadow-lg">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <div className="flex gap-1">
        <button
          type="button"
          className={`h-7 flex-1 rounded text-[10px] ${mode === "include" ? "bg-zinc-900 text-white" : "border"}`}
          onClick={() => setMode("include")}
        >
          {f.selected}
        </button>
        <button
          type="button"
          className={`h-7 flex-1 rounded text-[10px] ${mode === "exclude" ? "bg-zinc-900 text-white" : "border"}`}
          onClick={() => setMode("exclude")}
        >
          {f.exclude}
        </button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={f.search}
        className="h-8 w-full rounded border px-2 text-xs"
      />
      <div className="max-h-40 overflow-y-auto text-xs">
        {filtered.map((m) => {
          const key = String(m);
          const checked = selected.has(key);
          return (
            <label key={key} className="flex cursor-pointer items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
              />
              {key}
            </label>
          );
        })}
      </div>
      <div className="flex justify-between gap-1 border-t pt-2">
        {onTopN && (
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onTopN}>
            {f.topN}
          </button>
        )}
        <div className="ml-auto flex gap-1">
          <button type="button" className="rounded px-2 py-1 text-xs" onClick={onClose}>
            {f.cancel}
          </button>
          <button
            type="button"
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
            onClick={() => {
              if (selected.size === 0) onApply(null);
              else {
                const values = members.filter((m) => selected.has(String(m)));
                onApply({ fieldId: filter?.fieldId ?? "", type: mode, values });
              }
              onClose();
            }}
          >
            {f.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
