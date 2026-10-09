"use client";

import { useMemo, useState } from "react";
import { ArrowRight, History, Search, Target, UserPen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TabelAuditRecord } from "@/lib/tabel/tabel-api";
import { useTimesheetHistory } from "@/lib/timesheet/timesheet-norm-api";
import { fmtMonthLabel, fmtRuDate } from "@/components/timesheet/timesheet-shared";

type Kind = "all" | "status" | "settings";

const KIND_TABS: Array<[Kind, string]> = [
  ["all", "Все"],
  ["status", "Ручные правки"],
  ["settings", "Норматив"]
];

const PAGE = 50;

function recordMonth(r: TabelAuditRecord): string {
  return r.kind === "status" && r.subtitle ? r.subtitle.slice(0, 7) : r.changedAt.slice(0, 7);
}

export function TimesheetHistoryDialog({ open, month, onClose }: { open: boolean; month: string; onClose: () => void }) {
  const q = useTimesheetHistory(open);
  const [kind, setKind] = useState<Kind>("all");
  const [onlyMonth, setOnlyMonth] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (onlyMonth && recordMonth(r) !== month) return false;
      if (!s) return true;
      return [r.title, r.changedBy, r.comment, r.subtitle].some((v) => v?.toLowerCase().includes(s));
    });
  }, [q.data, kind, onlyMonth, month, search]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="tabel-theme flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <History className="size-4" />
            </span>
            История изменений табеля
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Кто, когда и что изменил вручную: было → стало, с комментарием. Автоматические отметки сюда не попадают.
          </p>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {KIND_TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => { setKind(k); setLimit(PAGE); }}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition",
                  kind === k ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={onlyMonth}
              onChange={(e) => { setOnlyMonth(e.target.checked); setLimit(PAGE); }}
            />
            Только {fmtMonthLabel(month)}
          </label>
          <div className="relative ml-auto min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Сотрудник, кто изменил, комментарий…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="border-b px-3 py-2 font-semibold">Когда</th>
                <th className="border-b px-3 py-2 font-semibold">Кто изменил</th>
                <th className="border-b px-3 py-2 font-semibold">Сотрудник / объект</th>
                <th className="border-b px-3 py-2 font-semibold">День</th>
                <th className="border-b px-3 py-2 font-semibold">Было → Стало</th>
                <th className="border-b px-3 py-2 font-semibold">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => {
                const isSettings = r.kind === "settings";
                return (
                  <tr key={r.id} className="align-top hover:bg-muted/40">
                    <td className="whitespace-nowrap border-b px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {new Date(r.changedAt).toLocaleString("ru-RU", { hour12: false })}
                    </td>
                    <td className="border-b px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <UserPen className="size-3 text-muted-foreground" /> {r.changedBy}
                      </span>
                    </td>
                    <td className="border-b px-3 py-2 font-semibold">
                      {isSettings ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          <Target className="size-3" /> {r.title}
                        </span>
                      ) : (
                        r.title
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b px-3 py-2 font-mono">
                      {!isSettings && r.subtitle ? fmtRuDate(r.subtitle) : "—"}
                    </td>
                    <td className="border-b px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded bg-muted px-1.5 py-0.5">{r.oldValue ?? "—"}</span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{r.newValue ?? "—"}</span>
                      </div>
                    </td>
                    <td className="max-w-[320px] border-b px-3 py-2 text-muted-foreground">{r.comment ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {q.isLoading ? "Загрузка..." : q.isError ? "Нет доступа к истории" : "Изменений нет"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="-mx-4 -mb-4 flex items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <span className="mr-auto text-[11px] text-muted-foreground">
            Показано {Math.min(limit, rows.length)} из {rows.length}
          </span>
          {rows.length > limit ? (
            <Button variant="outline" size="sm" onClick={() => setLimit(limit + PAGE)}>
              Показать ещё
            </Button>
          ) : null}
          <Button size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
