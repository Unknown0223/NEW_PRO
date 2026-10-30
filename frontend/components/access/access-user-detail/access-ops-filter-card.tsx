"use client";

import { useEffect, useState } from "react";
import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPTY_OPS_FILTER, type AccessOpsFilter, type AccessTreeModule } from "@/lib/access-operations-tree";

/** «Фильтр»: Родитель / Статус / Предоставление доступа → «Применить». */
export function AccessOpsFilterCard({
  tree,
  value,
  onApply
}: {
  tree: readonly AccessTreeModule[];
  value: AccessOpsFilter;
  onApply: (f: AccessOpsFilter) => void;
}) {
  const [draft, setDraft] = useState<AccessOpsFilter>(value);
  useEffect(() => setDraft(value), [value]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const isEmpty = JSON.stringify(value) === JSON.stringify(EMPTY_OPS_FILTER) && !dirty;

  return (
    <section className="shrink-0 rounded-xl border border-border/70 bg-card px-4 py-3" aria-labelledby="access-ops-filter-title">
      <h3 id="access-ops-filter-title" className="mb-2 text-sm font-semibold">
        Фильтр
      </h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft);
        }}
      >
        <label className="min-w-[10rem] flex-1">
          <span className="access-filter-field-label">Родитель</span>
          <select className="access-filter-select h-8 w-full text-xs" value={draft.module} onChange={(e) => setDraft({ ...draft, module: e.target.value })}>
            <option value="">Все разделы</option>
            {tree.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[9rem] flex-1">
          <span className="access-filter-field-label">Статус</span>
          <select
            className="access-filter-select h-8 w-full text-xs"
            value={draft.source}
            onChange={(e) => setDraft({ ...draft, source: e.target.value as AccessOpsFilter["source"] })}
          >
            <option value="all">Все выданные</option>
            <option value="role">Из роли</option>
            <option value="personal">Выдано лично</option>
            <option value="denied">Запрещено лично</option>
          </select>
        </label>
        <label className="min-w-[9rem] flex-1">
          <span className="access-filter-field-label">Предоставление доступа</span>
          <select
            className="access-filter-select h-8 w-full text-xs"
            value={draft.grant}
            onChange={(e) => setDraft({ ...draft, grant: e.target.value as AccessOpsFilter["grant"] })}
          >
            <option value="all">Все</option>
            <option value="yes">Может выдавать другим</option>
            <option value="no">Не может выдавать</option>
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={isEmpty}
            onClick={() => {
              setDraft(EMPTY_OPS_FILTER);
              onApply(EMPTY_OPS_FILTER);
            }}
            aria-label="Сбросить фильтр"
            title="Сбросить"
          >
            <FilterX className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button type="submit" size="sm" className="h-8 min-w-[7.5rem] bg-teal-700 text-white hover:bg-teal-800" disabled={!dirty}>
            Применить
          </Button>
        </div>
      </form>
    </section>
  );
}
