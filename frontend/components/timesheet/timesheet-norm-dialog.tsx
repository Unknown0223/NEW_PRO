"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Lock, LockOpen, Save, ShieldAlert, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAgentNormSettings, useSaveAgentNormSettings } from "@/lib/timesheet/timesheet-norm-api";

function fmtSum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseSum(raw: string): number {
  const n = Number(raw.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type Draft = { enabled: boolean; start_date: string; open: string; closed: string; comment: string };

export function TimesheetNormDialog({
  open,
  canEdit,
  onClose,
  onSaved
}: {
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const q = useAgentNormSettings(open);
  const save = useSaveAgentNormSettings();
  const [d, setD] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !q.data) return;
    setD({
      enabled: q.data.enabled,
      start_date: q.data.start_date,
      open: fmtSum(q.data.open_amount),
      closed: fmtSum(q.data.closed_amount),
      comment: ""
    });
    setError(null);
  }, [open, q.data]);

  const openAmount = d ? parseSum(d.open) : 0;
  const closedAmount = d ? parseSum(d.closed) : 0;
  const dirty =
    d != null &&
    q.data != null &&
    (d.enabled !== q.data.enabled ||
      d.start_date !== q.data.start_date ||
      openAmount !== q.data.open_amount ||
      closedAmount !== q.data.closed_amount);

  async function submit() {
    if (!d) return;
    if (openAmount <= 0 || closedAmount <= 0) return setError("Укажите обе суммы нормы больше нуля.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start_date)) return setError("Укажите дату начала.");
    setError(null);
    try {
      await save.mutateAsync({
        enabled: d.enabled,
        start_date: d.start_date,
        open_amount: openAmount,
        closed_amount: closedAmount,
        comment: d.comment.trim() || undefined
      });
      onSaved("Норматив сохранён — табель пересчитан");
      onClose();
    } catch {
      setError("Не удалось сохранить. Проверьте права доступа.");
    }
  }

  const disabled = !canEdit || save.isPending;
  const exampleNet = 950_000;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="tabel-theme max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Target className="size-4" />
            </span>
            Норматив агентов
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Табель агентов заполняется автоматически по сумме дневных заказов.
          </p>
        </DialogHeader>

        {!d ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{q.isError ? "Нет доступа к нормативу" : "Загрузка..."}</p>
        ) : (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 transition",
                d.enabled ? "border-primary/40 bg-primary/5" : "border-input bg-muted/30"
              )}
            >
              <button
                type="button"
                role="switch"
                aria-checked={d.enabled}
                disabled={disabled}
                onClick={() => setD({ ...d, enabled: !d.enabled })}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60",
                  d.enabled ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                    d.enabled ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
              <div>
                <div className="text-sm font-semibold">Расчёт по нормативу {d.enabled ? "включён" : "выключен"}</div>
                <div className="text-xs text-muted-foreground">
                  {d.enabled
                    ? "Каждый день агента отмечается автоматически: норма выполнена — «1», нет — «0»."
                    : "Табель агентов считается как раньше — по GPS-визитам."}
                </div>
              </div>
            </div>

            <div className={cn("space-y-4", !d.enabled && "pointer-events-none opacity-50")}>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarDays className="size-3" /> Действует с даты
                </label>
                <Input
                  type="date"
                  className="h-9 max-w-[200px]"
                  value={d.start_date}
                  disabled={disabled}
                  onChange={(e) => setD({ ...d, start_date: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["open", "Консигнация открыта", LockOpen, "text-emerald-600"],
                    ["closed", "Консигнация закрыта", Lock, "text-amber-600"]
                  ] as const
                ).map(([key, label, Icon, color]) => (
                  <div key={key} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className={cn("size-3.5", color)} /> {label}
                    </div>
                    <div className="relative">
                      <Input
                        inputMode="numeric"
                        className="h-10 pr-12 text-right font-mono text-base font-bold"
                        value={d[key]}
                        disabled={disabled}
                        onChange={(e) => setD({ ...d, [key]: fmtSum(parseSum(e.target.value)) })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">сум</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">дневная норма заказов</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 p-3 text-xs">
              <div className="mb-2 font-semibold">Как считается</div>
              <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>
                  <b className="text-foreground">Сумма дня</b> = заказы агента за день − отказы − возвраты по этим заказам.
                </li>
                <li>
                  Норма зависит от консигнации в этот день: открыта — <b className="text-foreground">{fmtSum(openAmount)}</b>,
                  закрыта — <b className="text-foreground">{fmtSum(closedAmount)}</b> сум. С лимитом обнуления агента не связана.
                </li>
                <li>
                  Сумма ≥ нормы — день <b className="text-emerald-600">засчитан («1»)</b>. Меньше —{" "}
                  <b className="text-rose-600">не засчитан («0»)</b>, фикса за день не начисляется.
                </li>
                <li>Выходной с выполненной нормой засчитывается, пока не набраны рабочие дни месяца.</li>
                <li>Ручная правка в табеле важнее автоматики. Причина видна в ячейке и в приложении агента.</li>
              </ol>
              <div className="mt-2 rounded-lg border border-dashed bg-background px-2.5 py-1.5 font-mono text-[11px]">
                Пример: 1 200 000 − отказ 150 000 − возврат 100 000 = {fmtSum(exampleNet)} →{" "}
                {exampleNet >= openAmount ? "✓" : "✗"} при открытой, {exampleNet >= closedAmount ? "✓" : "✗"} при закрытой
              </div>
            </div>

            {canEdit ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Комментарий к изменению
                </label>
                <textarea
                  value={d.comment}
                  onChange={(e) => setD({ ...d, comment: e.target.value })}
                  rows={2}
                  maxLength={500}
                  placeholder="Например: новое распоряжение с 01.10 (попадёт в историю)…"
                  className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                <ShieldAlert className="size-4 shrink-0" /> Только просмотр — нет права на изменение норматива.
              </div>
            )}

            {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
          </div>
        )}

        <div className="-mx-4 -mb-4 flex items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <span className="mr-auto truncate text-[11px] text-muted-foreground">
            {q.data?.updated_at
              ? `Изменено: ${q.data.updated_by ?? "—"} · ${new Date(q.data.updated_at).toLocaleString("ru-RU", { hour12: false })}`
              : "Стандартные значения"}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            {canEdit ? "Отмена" : "Закрыть"}
          </Button>
          {canEdit ? (
            <Button size="sm" disabled={!dirty || save.isPending} onClick={() => void submit()}>
              <Save className="mr-1 size-3.5" /> Сохранить
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
