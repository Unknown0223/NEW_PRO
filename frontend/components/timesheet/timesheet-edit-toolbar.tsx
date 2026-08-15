"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WORK_VALUES, isSunday } from "@/components/timesheet/timesheet-shared";

/**
 * Встроенные элементы панели редактирования табеля (как на макете):
 * массовое значение 0 / 0.5 / 1, подсказка спец-статусов (ⓘ) и выбор дней
 * (одиночный / диапазон / мультивыбор) для массового проставления.
 */
export function TimesheetEditToolbar({
  month,
  days,
  editDays,
  onToggleDay,
  onSelectRange,
  onClearDays,
  onToday,
  onBulk
}: {
  month: string;
  days: number[];
  editDays: number[];
  onToggleDay: (d: number) => void;
  onSelectRange: (from: number, to: number) => void;
  onClearDays: () => void;
  onToday: () => void;
  onBulk: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(15, days.length || 15));
  const dim = days.length;
  const today = new Date().toISOString().slice(0, 10);
  const isCurrentMonth = today.startsWith(month);
  const todayDay = Number(today.slice(8, 10));
  const selected = new Set(editDays);
  const bulkActive = editDays.length > 0;

  const daysLabel = editDays.length === 0
    ? "Дни"
    : editDays.length === 1
      ? `${String(editDays[0]).padStart(2, "0")}-й день`
      : isContinuous(editDays)
        ? `${String(editDays[0]).padStart(2, "0")}–${String(editDays[editDays.length - 1]).padStart(2, "0")}`
        : `${editDays.length} дн.`;

  return (
    <div className="flex items-center gap-1">
      <div className={cn("flex items-center gap-1 rounded-md px-1 py-0.5", bulkActive && "bg-primary/10 ring-1 ring-primary/40")}>
        {bulkActive ? <Zap className="mr-0.5 size-3 text-primary" /> : null}
        {WORK_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onBulk(v)}
            disabled={!bulkActive}
            title={bulkActive ? `Проставить «${v}» за выбранные дни` : "Сначала выберите дни"}
            className={cn(
              "grid h-8 w-9 place-items-center rounded-md border font-mono text-xs font-bold transition",
              bulkActive
                ? "border-primary/50 bg-background text-primary hover:bg-primary hover:text-primary-foreground"
                : "cursor-not-allowed border-input text-muted-foreground opacity-60"
            )}
          >
            {v}
          </button>
        ))}
        <span
          className="grid size-8 place-items-center rounded-md border border-input text-muted-foreground"
          title="Спец-статусы (Выходной / Отпуск / Больничный / Командировка) — через ⓘ на ячейке"
        >
          <Info className="size-3.5" />
        </span>
      </div>

      <DayPicker
        label={daysLabel}
        open={open}
        onOpenChange={setOpen}
        days={days}
        month={month}
        dim={dim}
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        selected={selected}
        isCurrentMonth={isCurrentMonth}
        todayDay={todayDay}
        onToggleDay={onToggleDay}
        onSelectRange={onSelectRange}
        onClearDays={onClearDays}
        onToday={onToday}
      />
    </div>
  );
}

function DayPicker({
  label,
  open,
  onOpenChange,
  days,
  month,
  dim,
  from,
  to,
  setFrom,
  setTo,
  selected,
  isCurrentMonth,
  todayDay,
  onToggleDay,
  onSelectRange,
  onClearDays,
  onToday
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: number[];
  month: string;
  dim: number;
  from: number;
  to: number;
  setFrom: (n: number) => void;
  setTo: (n: number) => void;
  selected: Set<number>;
  isCurrentMonth: boolean;
  todayDay: number;
  onToggleDay: (d: number) => void;
  onSelectRange: (from: number, to: number) => void;
  onClearDays: () => void;
  onToday: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(panelRef.current?.getBoundingClientRect().width ?? 288, vw - 16);
    // Якорим по правому краю кнопки (как раньше right-0), но не выходим за экран.
    let left = r.right - panelW;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    let top = r.bottom + 6;
    const estH = panelRef.current?.getBoundingClientRect().height ?? 360;
    if (top + estH > vh - 8) top = Math.max(8, r.top - 6 - estH);
    setBox({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => requestAnimationFrame(() => reposition()));
    return () => cancelAnimationFrame(id);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => reposition();
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <Button ref={anchorRef} variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(!open)}>
        <CalendarDays className="mr-1 size-3.5" /> {label}
        <ChevronDown className="ml-1 size-3" />
      </Button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[100] w-72 max-w-[calc(100vw-1rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
              style={{ top: box.top, left: box.left }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold">Выбор дней</div>
                <div className="flex gap-1">
                  {isCurrentMonth ? (
                    <button onClick={onToday} className="rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                      Сегодня
                    </button>
                  ) : null}
                  <button onClick={onClearDays} className="rounded bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                    Очистить
                  </button>
                </div>
              </div>
              <div className="mb-2.5 flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Диапазон:</span>
                <input type="number" min={1} max={dim} value={from} onChange={(e) => setFrom(Number(e.target.value))} className="w-12 rounded-md border bg-background px-1.5 py-1 text-center font-mono text-xs font-bold" />
                <span className="text-muted-foreground">—</span>
                <input type="number" min={1} max={dim} value={to} onChange={(e) => setTo(Number(e.target.value))} className="w-12 rounded-md border bg-background px-1.5 py-1 text-center font-mono text-xs font-bold" />
                <button onClick={() => onSelectRange(from, to)} className="ml-auto rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold text-primary-foreground">
                  Выбрать
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const date = `${month}-${String(d).padStart(2, "0")}`;
                  const sel = selected.has(d);
                  const sun = isSunday(date);
                  const isT = isCurrentMonth && d === todayDay;
                  return (
                    <button
                      key={d}
                      onClick={() => onToggleDay(d)}
                      className={cn(
                        "h-7 rounded-md font-mono text-[11px] font-bold transition",
                        sel ? "bg-primary text-primary-foreground shadow" : isT ? "bg-primary/15 text-primary" : sun ? "bg-blue-50 text-blue-500 dark:bg-blue-950/40" : "bg-muted hover:bg-muted-foreground/10"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Выберите диапазон, затем уберите лишние дни. Значение проставится только выбранным (зелёным) дням.
              </p>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function isContinuous(days: number[]): boolean {
  for (let i = 1; i < days.length; i++) if (days[i] !== days[i - 1] + 1) return false;
  return days.length > 0;
}
