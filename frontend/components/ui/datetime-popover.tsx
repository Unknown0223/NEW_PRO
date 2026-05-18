"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const RU_MONTH_SHORT = [
  "Янв.",
  "Февр.",
  "Март",
  "Апр.",
  "Май",
  "Июнь",
  "Июль",
  "Авг.",
  "Сент.",
  "Окт.",
  "Нояб.",
  "Дек."
] as const;

const RU_WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function daysMatrix(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  let start = first.getDay() - 1;
  if (start < 0) start = 6;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function shiftMonthYm(y: number, m0: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m0 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function parseLocalDateTime(value: string): Date {
  if (!value?.trim()) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function localValueToDatetimeInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** «11 Апр. 2024 20:44» — Lalaku-style */
export function formatRuDateTimeShort(value: string): string {
  const d = parseLocalDateTime(value);
  const day = d.getDate();
  const mon = RU_MONTH_SHORT[d.getMonth()] ?? "";
  const y = d.getFullYear();
  const capMon = mon ? mon.charAt(0).toUpperCase() + mon.slice(1) : "";
  return `${day} ${capMon} ${y} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** «11 Апр. 2024» — faqat sana */
export function formatRuDateShort(value: string): string {
  const d = parseLocalDateTime(value);
  const day = d.getDate();
  const mon = RU_MONTH_SHORT[d.getMonth()] ?? "";
  const y = d.getFullYear();
  const capMon = mon ? mon.charAt(0).toUpperCase() + mon.slice(1) : "";
  return `${day} ${capMon} ${y}`;
}

function SingleMonthCalendar({
  year,
  month,
  selectedYmd,
  onPick,
  onShiftMonth
}: {
  year: number;
  month: number;
  selectedYmd: string;
  onPick: (iso: string) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const title = new Date(year, month, 1).toLocaleDateString("ru-RU", {
    month: "short",
    year: "numeric"
  });
  const matrix = useMemo(() => daysMatrix(year, month), [year, month]);

  return (
    <div className="w-[12rem] shrink-0 sm:w-[12.25rem]">
      <div className="mb-0.5 flex items-center justify-between gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-6 w-6 shrink-0"
          aria-label="Предыдущий месяц"
          onClick={() => onShiftMonth(-1)}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <div className="min-w-0 flex-1 truncate px-0.5 text-center text-[0.7rem] font-medium capitalize text-foreground">
          {title}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-6 w-6 shrink-0"
          aria-label="Следующий месяц"
          onClick={() => onShiftMonth(1)}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px text-[0.6rem] text-muted-foreground">
        {RU_WD.map((w) => (
          <div key={w} className="py-0.5 text-center font-medium">
            {w}
          </div>
        ))}
        {matrix.flatMap((row, ri) =>
          row.map((day, ci) => {
            if (day == null) {
              return <div key={`e-${ri}-${ci}`} className="h-6" />;
            }
            const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
            const sel = iso === selectedYmd;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onPick(iso)}
                className={cn(
                  "flex h-6 items-center justify-center rounded-sm text-[0.65rem] transition-colors",
                  sel && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                  !sel && "hover:bg-muted"
                )}
              >
                {day}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

type DateTimePickerFieldProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  /** true: faqat sana, tungi 00:00 saqlanadi, popoverda vaqt yo‘q */
  dateOnly?: boolean;
  /** vaqt paneli joylashuvi: pastda yoki kalendar yonida */
  timePlacement?: "bottom" | "side";
  /** soat/daqiqani mouse wheel bilan o‘zgartirish */
  wheelTimeAdjust?: boolean;
};

/**
 * Bir sana-vaqt: ichki tugmalar (kun ±1), kalendar popover, vaqt — standart input type="time".
 * Qiymat: `YYYY-MM-DDTHH:mm` (datetime-local format).
 */
export function DateTimePickerField({
  id,
  value,
  onChange,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  dateOnly = false,
  timePlacement = "bottom",
  wheelTimeAdjust = false
}: DateTimePickerFieldProps) {
  const TIME_ROW_H = 28;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const hourSnapTimerRef = useRef<number | null>(null);
  const minuteSnapTimerRef = useRef<number | null>(null);
  const syncingScrollRef = useRef(false);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const base = useMemo(() => parseLocalDateTime(value), [value]);
  const selectedYmd = `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;

  const [viewYm, setViewYm] = useState(() => ({
    y: base.getFullYear(),
    m: base.getMonth()
  }));

  const [panelTime, setPanelTime] = useState(() => `${pad2(base.getHours())}:${pad2(base.getMinutes())}`);
  const [panelYmd, setPanelYmd] = useState(selectedYmd);

  useEffect(() => {
    if (!open) return;
    const d = parseLocalDateTime(value);
    setViewYm({ y: d.getFullYear(), m: d.getMonth() });
    setPanelTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    setPanelYmd(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }, [open, value]);

  const shiftDay = useCallback(
    (delta: number) => {
      const d = parseLocalDateTime(value);
      d.setDate(d.getDate() + delta);
      if (dateOnly) {
        d.setHours(0, 0, 0, 0);
      }
      onChange(localValueToDatetimeInput(d));
    },
    [value, onChange, dateOnly]
  );

  const reposition = useCallback(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const measured = panelRef.current?.getBoundingClientRect().width ?? 0;
    const panelW = measured > 48 ? measured : 280;
    let left = r.left;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    const maxH = Math.max(200, vh - top - 10);
    if (top + maxH > vh - 8) {
      top = Math.max(8, r.top - 8 - Math.min(maxH, 320));
    }
    setBox({ top, left });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const idRaf = requestAnimationFrame(() => requestAnimationFrame(() => reposition()));
    return () => cancelAnimationFrame(idRaf);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const ro = new ResizeObserver(() => reposition());
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const applyPanel = useCallback(() => {
    let next: Date;
    if (dateOnly) {
      next = new Date(`${panelYmd}T00:00:00`);
    } else {
      const [hh, mm] = panelTime.split(":").map((x) => Number.parseInt(x, 10));
      const h = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 0;
      const m = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
      next = new Date(`${panelYmd}T${pad2(h)}:${pad2(m)}:00`);
    }
    if (!Number.isNaN(next.getTime())) {
      onChange(localValueToDatetimeInput(next));
    }
    setOpen(false);
  }, [panelTime, panelYmd, onChange, dateOnly]);

  const display = dateOnly ? formatRuDateShort(value) : formatRuDateTimeShort(value);
  const hourValue = panelTime.slice(0, 2);
  const minuteValue = panelTime.slice(3, 5);
  const hourOptions = Array.from({ length: 24 }, (_, i) => pad2(i));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => pad2(i));

  const getCenterOffset = useCallback((el: HTMLDivElement | null) => {
    const h = el?.clientHeight ?? 0;
    return Math.max(0, (h - TIME_ROW_H) / 2);
  }, []);

  const syncPickerScroll = useCallback(
    (part: "hour" | "minute", val: string, behavior: ScrollBehavior = "auto") => {
      const el = part === "hour" ? hourListRef.current : minuteListRef.current;
      if (!el) return;
      const idx = Number.parseInt(val, 10);
      if (!Number.isFinite(idx)) return;
      const centerOffset = getCenterOffset(el);
      syncingScrollRef.current = true;
      el.scrollTo({ top: idx * TIME_ROW_H - centerOffset, behavior });
      window.setTimeout(() => {
        syncingScrollRef.current = false;
      }, behavior === "smooth" ? 200 : 0);
    },
    [getCenterOffset]
  );

  const snapAndPick = useCallback(
    (part: "hour" | "minute") => {
      const el = part === "hour" ? hourListRef.current : minuteListRef.current;
      if (!el) return;
      const centerOffset = getCenterOffset(el);
      const raw = (el.scrollTop + centerOffset) / TIME_ROW_H;
      const maxIdx = part === "hour" ? 23 : 59;
      const idx = Math.max(0, Math.min(maxIdx, Math.round(raw)));
      const next = pad2(idx);
      const [h, m] = panelTime.split(":");
      const nextH = part === "hour" ? next : h;
      const nextM = part === "minute" ? next : m;
      setPanelTime(`${nextH}:${nextM}`);
      syncingScrollRef.current = true;
      el.scrollTo({ top: idx * TIME_ROW_H - centerOffset, behavior: "smooth" });
      window.setTimeout(() => {
        syncingScrollRef.current = false;
      }, 220);
    },
    [getCenterOffset, panelTime]
  );

  const wheelAdjustPart = useCallback(
    (part: "hour" | "minute", delta: number) => {
      const [rawH, rawM] = panelTime.split(":");
      let h = Number.parseInt(rawH ?? "0", 10);
      let m = Number.parseInt(rawM ?? "0", 10);
      if (!Number.isFinite(h)) h = 0;
      if (!Number.isFinite(m)) m = 0;
      if (part === "hour") {
        h = (h + delta + 24) % 24;
      } else {
        m = (m + delta + 60) % 60;
      }
      setPanelTime(`${pad2(h)}:${pad2(m)}`);
    },
    [panelTime]
  );

  useEffect(() => {
    if (!open || dateOnly || timePlacement !== "side") return;
    syncPickerScroll("hour", hourValue, "auto");
    syncPickerScroll("minute", minuteValue, "auto");
  }, [open, dateOnly, timePlacement, hourValue, minuteValue, syncPickerScroll]);

  useEffect(() => {
    return () => {
      if (hourSnapTimerRef.current != null) window.clearTimeout(hourSnapTimerRef.current);
      if (minuteSnapTimerRef.current != null) window.clearTimeout(minuteSnapTimerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={anchorRef}
        id={id}
        className={cn(
          "flex h-10 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "pointer-events-none opacity-50",
          ariaInvalid && "border-destructive ring-destructive/20",
          className
        )}
      >
        <button
          type="button"
          className="flex h-full w-9 shrink-0 items-center justify-center border-r border-border/80 text-muted-foreground hover:bg-muted/60"
          aria-label="Открыть календарь"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-full w-8 shrink-0 items-center justify-center border-r border-border/80 text-muted-foreground hover:bg-muted/60"
          aria-label="На день назад"
          disabled={disabled}
          onClick={() => shiftDay(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate px-2 text-left text-sm text-foreground hover:bg-muted/40"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {display}
        </button>
        <button
          type="button"
          className="flex h-full w-8 shrink-0 items-center justify-center border-l border-border/80 text-muted-foreground hover:bg-muted/60"
          aria-label="На день вперёд"
          disabled={disabled}
          onClick={() => shiftDay(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[100] w-max max-w-[min(calc(100vw-1rem),20rem)] rounded-lg border border-border/80 bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-black/5"
              style={{ top: box.top, left: box.left }}
            >
              <div className={cn("flex gap-3", !dateOnly && timePlacement === "side" ? "items-start" : "items-stretch")}>
                <SingleMonthCalendar
                  year={viewYm.y}
                  month={viewYm.m}
                  selectedYmd={panelYmd}
                  onPick={(ymd) => setPanelYmd(ymd)}
                  onShiftMonth={(delta) => setViewYm((v) => shiftMonthYm(v.y, v.m, delta))}
                />
                {!dateOnly && timePlacement === "side" ? (
                  <div className="w-[6.5rem]">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1">
                      <div
                        ref={hourListRef}
                        className="h-[9.25rem] overflow-y-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        onScroll={() => {
                          if (syncingScrollRef.current) return;
                          if (hourSnapTimerRef.current != null) window.clearTimeout(hourSnapTimerRef.current);
                          hourSnapTimerRef.current = window.setTimeout(() => snapAndPick("hour"), 100);
                        }}
                        onWheel={(e) => {
                          if (!wheelTimeAdjust) return;
                          // Native wheel scroll gives smoother inertial movement.
                        }}
                      >
                        {hourOptions.map((h) => (
                          <button
                            key={h}
                            type="button"
                            className={cn(
                              "flex h-7 w-full items-center justify-center text-center font-mono text-sm transition-colors",
                              h === hourValue
                                ? "bg-primary/15 font-semibold text-primary"
                                : "text-foreground/80 hover:bg-muted/50"
                            )}
                            onClick={() => setPanelTime(`${h}:${minuteValue}`)}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                      <div className="flex h-[9.25rem] items-center justify-center">
                        <span className="text-center text-base text-muted-foreground">:</span>
                      </div>
                      <div
                        ref={minuteListRef}
                        className="h-[9.25rem] overflow-y-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        onScroll={() => {
                          if (syncingScrollRef.current) return;
                          if (minuteSnapTimerRef.current != null) window.clearTimeout(minuteSnapTimerRef.current);
                          minuteSnapTimerRef.current = window.setTimeout(() => snapAndPick("minute"), 100);
                        }}
                        onWheel={(e) => {
                          if (!wheelTimeAdjust) return;
                          // Native wheel scroll gives smoother inertial movement.
                        }}
                      >
                        {minuteOptions.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={cn(
                              "flex h-7 w-full items-center justify-center text-center font-mono text-sm transition-colors",
                              m === minuteValue
                                ? "bg-primary/15 font-semibold text-primary"
                                : "text-foreground/80 hover:bg-muted/50"
                            )}
                            onClick={() => setPanelTime(`${hourValue}:${m}`)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {!dateOnly && timePlacement !== "side" ? (
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                  <span className="shrink-0 text-xs text-muted-foreground">Время</span>
                  <Input
                    type="time"
                    className="h-8 flex-1 font-mono text-sm"
                    value={panelTime}
                    onChange={(e) => setPanelTime(e.target.value)}
                  />
                </div>
              ) : null}
              <div className={cn("mt-3 flex justify-end gap-2")}>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => applyPanel()}>
                  Применить
                </Button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
