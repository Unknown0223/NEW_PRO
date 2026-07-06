"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CLIENT_BALANCES_FILTER_VISIBILITY_META,
  DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY,
  type ClientBalancesFilterVisibility,
  saveClientBalancesFilterVisibility
} from "@/lib/client-balances-filters-visibility";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ClientBalancesFilterVisibility;
  onChange: (next: ClientBalancesFilterVisibility) => void;
};

export function ClientBalancesFiltersVisibilityDialog({ open, onOpenChange, value, onChange }: Props) {
  const [draft, setDraft] = useState<ClientBalancesFilterVisibility>(value);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(value);
      setQ("");
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CLIENT_BALANCES_FILTER_VISIBILITY_META;
    return CLIENT_BALANCES_FILTER_VISIBILITY_META.filter((x) => x.label.toLowerCase().includes(s));
  }, [q]);

  const setAll = (on: boolean) => {
    setDraft(() => {
      const next = { ...DEFAULT_CLIENT_BALANCES_FILTER_VISIBILITY };
      (Object.keys(next) as (keyof ClientBalancesFilterVisibility)[]).forEach((k) => {
        next[k] = on;
      });
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,560px)] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-10 text-left">
          <DialogTitle className="text-base">Видимость фильтров</DialogTitle>
          <DialogDescription className="text-xs">
            Отметьте, какие поля показывать на панели. Сохраняется в браузере.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-2 px-4 py-2">
          <Input
            className="h-8 text-sm"
            placeholder="Поиск…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="xs" className="text-xs" onClick={() => setAll(true)}>
              Показать все
            </Button>
            <Button type="button" variant="outline" size="xs" className="text-xs" onClick={() => setAll(false)}>
              Скрыть все
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-4 py-1">
          {filtered.map(({ key, label }) => {
            const visible = draft[key];
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-emerald-600"
                  checked={visible}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {visible ? (
                  <Eye className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </label>
            );
          })}
        </div>

        <DialogFooter className="mx-0 mb-0 flex shrink-0 flex-col gap-2 rounded-b-xl border-t border-border/60 bg-muted/50 px-4 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              saveClientBalancesFilterVisibility(draft);
              onChange(draft);
              onOpenChange(false);
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
