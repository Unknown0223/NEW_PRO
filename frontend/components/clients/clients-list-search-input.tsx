"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CLIENT_LIST_SEARCHABLE_FIELDS,
  clientListSearchPlaceholder
} from "@/lib/client-list-search-fields";
import { cn } from "@/lib/utils";
import { CircleHelp, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

/** Kompakt qidiruv — matn yoziladi, keyin lupa tugmasi yoki Enter bosiladi. */
export function ClientsListSearchInput({ value, onChange, className }: Props) {
  const [draft, setDraft] = useState(value);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const submit = useCallback(() => {
    onChange(draft.trim());
  }, [draft, onChange]);

  useEffect(() => {
    if (!fieldsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setFieldsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [fieldsOpen]);

  return (
    <div ref={wrapRef} className={cn("relative flex items-center gap-1", className)}>
      <div className="flex min-w-[9rem] flex-1 items-stretch gap-1 sm:max-w-[15rem]">
        <Input
          type="search"
          placeholder={clientListSearchPlaceholder()}
          className="h-8 min-w-0 flex-1 border-input text-xs text-gray-900 placeholder:text-gray-500"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={submit}
          aria-label="Поиск"
          title="Поиск"
        >
          <Search className="size-3.5" />
        </Button>
      </div>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-gray-600 transition-colors hover:bg-muted/60 hover:text-gray-900"
        title="По каким полям ищется"
        aria-label="Поля поиска"
        aria-expanded={fieldsOpen}
        onClick={() => setFieldsOpen((o) => !o)}
      >
        <CircleHelp className="size-3.5" strokeWidth={2} />
      </button>
      {fieldsOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 max-h-64 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg scrollbar-none"
          role="dialog"
          aria-label="Поля поиска"
        >
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Поиск по столбцам
          </p>
          <ul className="py-1">
            {CLIENT_LIST_SEARCHABLE_FIELDS.map((f) => (
              <li
                key={f.columnId}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-800"
              >
                <Search className="size-3 shrink-0 text-emerald-600" aria-hidden />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
