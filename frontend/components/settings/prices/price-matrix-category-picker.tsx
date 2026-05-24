"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Cat = { id: number; label: string };

type Props = {
  flatCats: Cat[];
  selected: Set<number>;
  onSelectedChange: (next: Set<number>) => void;
  disabled?: boolean;
};

export function PriceMatrixCategoryPicker({
  flatCats,
  selected,
  onSelectedChange,
  disabled
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatCats;
    return flatCats.filter((c) => c.label.toLowerCase().includes(q));
  }, [flatCats, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someFilteredSelected = filtered.some((c) => selected.has(c.id)) && !allFilteredSelected;

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    for (const c of filtered) {
      if (checked) next.add(c.id);
      else next.delete(c.id);
    }
    onSelectedChange(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border bg-muted/15 shadow-sm lg:min-h-[420px]">
      <div className="border-b bg-card px-3 py-2 text-xs font-medium">Категории</div>
      <div className="relative border-b px-2 py-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-9 text-sm"
          placeholder="Поиск категории…"
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium select-none">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={allFilteredSelected}
          ref={(el) => {
            if (el) el.indeterminate = someFilteredSelected;
          }}
          disabled={disabled || filtered.length === 0}
          onChange={(e) => toggleAll(e.target.checked)}
        />
        <span>Все категории</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {selected.size}/{flatCats.length}
        </span>
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">Kategoriya topilmadi.</p>
        ) : (
          filtered.map((c) => {
            const on = selected.has(c.id);
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-b border-border/50 px-3 py-2 text-sm transition-colors last:border-0",
                  on ? "bg-primary/8 font-medium" : "hover:bg-muted/50"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggleOne(c.id)}
                />
                <span className="min-w-0 truncate" title={c.label}>
                  {c.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
