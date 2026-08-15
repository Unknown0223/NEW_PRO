"use client";

import { useMemo, useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const initial = useMemo(
    () => new Set(filter?.values?.map(String) ?? []),
    [filter?.values]
  );
  const [selected, setSelected] = useState<Set<string>>(initial);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => String(m).toLowerCase().includes(q));
  }, [members, search]);

  function toggle(value: string | number) {
    const key = String(value);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleApply() {
    if (selected.size === 0) {
      onApply(null);
      onClose();
      return;
    }
    const values = members.filter((m) => selected.has(String(m)));
    onApply({ fieldId: filter?.fieldId ?? "", type: mode, values });
  }

  return (
    <div className="w-64 space-y-2 rounded-md border border-border bg-popover p-3 shadow-md">
      <div className="text-xs font-semibold">{fieldLabel}</div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "include" ? "default" : "outline"}
          className="h-7 flex-1 text-[10px]"
          onClick={() => setMode("include")}
        >
          {f.selected}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "exclude" ? "default" : "outline"}
          className="h-7 flex-1 text-[10px]"
          onClick={() => setMode("exclude")}
        >
          {f.exclude}
        </Button>
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={f.search}
        className="h-8 text-xs"
      />
      <div className="max-h-40 space-y-0.5 overflow-y-auto">
        {filteredMembers.map((m) => {
          const key = String(m);
          const checked = selected.has(key);
          return (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/60",
                checked && "bg-muted/40"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(m)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{key}</span>
            </label>
          );
        })}
        {filteredMembers.length === 0 && (
          <p className="text-[10px] text-muted-foreground">{f.noOptions}</p>
        )}
      </div>
      <div className="flex justify-between gap-1 border-t border-border pt-2">
        {onTopN && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onTopN}>
            {f.topN}
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            {f.cancel}
          </Button>
          <Button type="button" size="sm" className="h-7 text-xs" onClick={handleApply}>
            {f.apply}
          </Button>
        </div>
      </div>
    </div>
  );
}
