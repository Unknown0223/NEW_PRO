"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ReportBuilderShareCandidate } from "@/lib/pivot-bridge";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportName: string;
  candidates: ReportBuilderShareCandidate[];
  loadingCandidates: boolean;
  submitting: boolean;
  onConfirm: (userIds: number[]) => void;
};

/** Tanlangan hisobotni konstruktor ruxsati bor veb-foydalanuvchilarga ulashish. */
export function SharePivotReportDialog({
  open,
  onOpenChange,
  reportName,
  candidates,
  loadingCandidates,
  submitting,
  onConfirm
}: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setQ("");
      setSelected(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.login.toLowerCase().includes(needle) ||
        c.role.toLowerCase().includes(needle)
    );
  }, [candidates, q]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[480px] max-w-[calc(100%-2rem)] flex-col gap-3 rounded-sm border border-[#d4d4d4] bg-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Поделиться отчётом
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            «{reportName}» — пользователи с доступом к веб-конструктору. После подтверждения отчёт
            появится у них в «Сохранённые отчёты».
          </p>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени или логину…"
          className="h-9"
        />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            Выбрано: {selected.size}
            {candidates.length ? ` / ${candidates.length}` : ""}
          </span>
          <button
            type="button"
            className="underline disabled:opacity-40"
            disabled={filtered.length === 0}
            onClick={() => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (allFilteredSelected) {
                  for (const c of filtered) next.delete(c.id);
                } else {
                  for (const c of filtered) next.add(c.id);
                }
                return next;
              });
            }}
          >
            {allFilteredSelected ? "Снять все" : "Выбрать все"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-border">
          {loadingCandidates ? (
            <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Загрузка пользователей…
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Нет пользователей с доступом к конструктору отчётов.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50",
                        checked && "bg-amber-50/80 dark:bg-amber-950/30"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-amber-600"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{c.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {c.login}
                          {c.role ? ` · ${c.role}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || submitting}
            onClick={() => onConfirm([...selected])}
          >
            {submitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
