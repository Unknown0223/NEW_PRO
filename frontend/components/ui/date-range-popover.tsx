"use client";

import { Button } from "@/components/ui/button";
import {
  envelopeFromPeriods,
  monthsCoveredByRange,
  monthsFromPeriods,
  selectedDaysToPeriods,
  selectedMonthsToPeriods,
  serializeDatePeriods,
  type DatePeriod,
  ymIndex
} from "@/components/ui/date-range-periods";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export type { DatePeriod };
export {
  envelopeFromPeriods,
  monthBoundsFromYm,
  monthsCoveredByRange,
  monthsFromPeriods,
  daysFromPeriods,
  daysCoveredByRange,
  selectedDaysToPeriods,
  parseDatePeriods,
  selectedMonthsToPeriods,
  serializeDatePeriods,
  ymIndex
} from "@/components/ui/date-range-periods";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Mahalliy sana YYYY-MM-DD */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmd(s: string): Date | null {
  const t = s?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, day] = t.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

function formatDisplayRu(from: string, to: string): string {
  const a = parseYmd(from);
  const b = parseYmd(to);
  const fmt = (d: Date) =>
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (a && b) return `${fmt(a)} — ${fmt(b)}`;
  if (a && !to?.trim()) return `${fmt(a)} — …`;
  if (!from?.trim() && b) return `… — ${fmt(b)}`;
  return `${from || "…"} — ${to || "…"}`;
}

/** Bo‘sh oxir/bosh — bir kunlik oralikka aylantiradi; tartibni tuzatadi. */
export function normalizeDateRange(from: string, to: string): { dateFrom: string; dateTo: string } {
  const f = from?.trim() ?? "";
  const t = to?.trim() ?? "";
  if (f && !t) return { dateFrom: f, dateTo: f };
  if (!f && t) return { dateFrom: t, dateTo: t };
  if (f && t && f > t) return { dateFrom: t, dateTo: f };
  return { dateFrom: f, dateTo: t };
}

/** Standart tugma / filter matni (ru-RU) — faqat boshlanish — tugash (avvalgidek). */
export function formatDateRangeButton(
  from: string,
  to: string,
  _periods?: DatePeriod[] | null
): string {
  return formatDisplayRu(from, to);
}

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

function MonthCalendar({
  year,
  month,
  selectedDays,
  rangeFrom,
  rangeTo,
  onPick,
  onShiftMonth
}: {
  year: number;
  month: number;
  selectedDays: ReadonlySet<string>;
  rangeFrom: string;
  rangeTo: string;
  onPick: (iso: string) => void;
  onShiftMonth: (delta: number) => void;
}) {
  const title = new Date(year, month, 1).toLocaleDateString("ru-RU", {
    month: "short",
    year: "numeric"
  });
  const matrix = useMemo(() => daysMatrix(year, month), [year, month]);
  const useDiscrete = selectedDays.size > 0;

  const inRange = (day: number) => {
    const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    if (useDiscrete) return selectedDays.has(iso);
    if (!rangeFrom) return false;
    if (!rangeTo) return iso === rangeFrom;
    return iso >= rangeFrom && iso <= rangeTo;
  };

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
            const hit = inRange(day);
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={hit}
                onClick={() => onPick(iso)}
                className={cn(
                  "flex h-6 items-center justify-center rounded-sm text-[0.65rem] transition-colors",
                  hit && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                  !hit && "hover:bg-muted"
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

const RU_MONTH_GRID = [
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

function MonthYearGrid({
  year,
  onYearChange,
  selectedMonths,
  onToggleMonth
}: {
  year: number;
  onYearChange: (y: number) => void;
  selectedMonths: ReadonlySet<number>;
  onToggleMonth: (monthIndex0: number) => void;
}) {
  return (
    <div className="w-max max-w-[15.5rem]">
      <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-7 w-7 shrink-0"
          aria-label="Предыдущий год"
          onClick={() => onYearChange(year - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-xs font-semibold tabular-nums text-foreground">{year}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-7 w-7 shrink-0"
          aria-label="Следующий год"
          onClick={() => onYearChange(year + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {RU_MONTH_GRID.map((label, i) => {
          const selected = selectedMonths.has(ymIndex(year, i));
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleMonth(i)}
              className={cn(
                "rounded-md border px-1 py-2 text-center text-[0.65rem] font-medium leading-tight transition-colors",
                selected &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                !selected && "border-border/60 bg-background text-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[0.6rem] leading-snug text-muted-foreground">
        Клик — включить/выключить месяц. Можно выбрать несколько. Затем «Принять» — окно закроется
        и период отобразится сверху.
      </p>
    </div>
  );
}

function buildPresets(): { label: string; from: string; to: string }[] {
  const today = new Date();
  const y = (d: Date) => localYmd(d);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last7to = new Date(today);
  const last7from = new Date(today);
  last7from.setDate(last7from.getDate() - 6);

  const last30to = new Date(today);
  const last30from = new Date(today);
  last30from.setDate(last30from.getDate() - 29);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    { label: "Сегодня", from: y(today), to: y(today) },
    { label: "Вчера", from: y(yesterday), to: y(yesterday) },
    { label: "Последние 7 дней", from: y(last7from), to: y(last7to) },
    { label: "Последние 30 дней", from: y(last30from), to: y(last30to) },
    { label: "Этот месяц", from: y(thisMonthStart), to: y(thisMonthEnd) },
    { label: "Прошлый месяц", from: y(lastMonthStart), to: y(lastMonthEnd) }
  ];
}

type PanelProps = {
  dateFrom?: string;
  dateTo?: string;
  /** Bo‘shliqli oylar — URL/API `date_periods` */
  datePeriods?: DatePeriod[] | null;
  onApply: (next: { dateFrom: string; dateTo: string; datePeriods?: DatePeriod[] }) => void;
  onClose: () => void;
  /** true — «Применить» yo‘q; tanlov darhol `onApply` orqali saqlanadi */
  autoSave?: boolean;
};

function seedSelectedMonths(
  dateFrom: string,
  dateTo: string,
  datePeriods?: DatePeriod[] | null
): Set<number> {
  if (datePeriods && datePeriods.length > 0) {
    return new Set(monthsFromPeriods(datePeriods));
  }
  if (dateFrom && dateTo) {
    return new Set(monthsCoveredByRange(dateFrom, dateTo));
  }
  return new Set();
}

function DateRangePanel({
  dateFrom,
  dateTo,
  datePeriods,
  onApply,
  onClose,
  autoSave = false
}: PanelProps) {
  const from0 = dateFrom ?? "";
  const to0 = dateTo ?? "";
  const [df, setDf] = useState(from0);
  const [dt, setDt] = useState(to0);
  const [dayAnchor, setDayAnchor] = useState<string | null>(null);
  const [viewLeft, setViewLeft] = useState(() => {
    const p = parseYmd(from0) ?? new Date();
    return { y: p.getFullYear(), m: p.getMonth() };
  });
  const [viewRight, setViewRight] = useState(() => {
    const f = parseYmd(from0) ?? new Date();
    const t = parseYmd(to0) ?? new Date();
    if (f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()) {
      return shiftMonthYm(f.getFullYear(), f.getMonth(), 1);
    }
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [panelMode, setPanelMode] = useState<"days" | "daysPick" | "months">("days");
  const [pickYear, setPickYear] = useState(() => new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(() =>
    seedSelectedMonths(from0, to0, datePeriods)
  );
  /** «Выбрать дни» — har ochilishda toza; tanlov faqat shu sessiyada. */
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set());

  const periodsKey = serializeDatePeriods(datePeriods ?? []);
  const isCalendarMode = panelMode === "days" || panelMode === "daysPick";

  useEffect(() => {
    const nextFrom = dateFrom ?? "";
    const nextTo = dateTo ?? "";
    setDf(nextFrom);
    setDt(nextTo);
    setDayAnchor(null);
    setSelectedMonths(seedSelectedMonths(nextFrom, nextTo, datePeriods));
    // daysPick tanlovini tashqi sync bilan to‘ldirmaymiz — rejim ochilganda toza qoladi
    const f = parseYmd(nextFrom) ?? new Date();
    const t = parseYmd(nextTo) ?? new Date();
    setViewLeft({ y: f.getFullYear(), m: f.getMonth() });
    if (f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth()) {
      setViewRight(shiftMonthYm(f.getFullYear(), f.getMonth(), 1));
    } else {
      setViewRight({ y: t.getFullYear(), m: t.getMonth() });
    }
    setPickYear(f.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- datePeriods mazmuni periodsKey orqali
  }, [dateFrom, dateTo, periodsKey]);

  const syncViewsFromRange = useCallback((from: string, to: string) => {
    const a = parseYmd(from) ?? new Date();
    const b = parseYmd(to) ?? new Date();
    setViewLeft({ y: a.getFullYear(), m: a.getMonth() });
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      setViewRight(shiftMonthYm(a.getFullYear(), a.getMonth(), 1));
    } else {
      setViewRight({ y: b.getFullYear(), m: b.getMonth() });
    }
  }, []);

  const commitRange = useCallback(
    (from: string, to: string) => {
      if (!autoSave) return;
      const n = normalizeDateRange(from, to);
      if (!n.dateFrom || !parseYmd(n.dateFrom) || !parseYmd(n.dateTo)) return;
      onApply({ dateFrom: n.dateFrom, dateTo: n.dateTo, datePeriods: undefined });
    },
    [autoSave, onApply]
  );

  const applyMonthSelection = useCallback(
    (months: ReadonlySet<number>, close: boolean) => {
      const periods = selectedMonthsToPeriods(months);
      const env = envelopeFromPeriods(periods);
      if (!env) return;
      setDf(env.from);
      setDt(env.to);
      setSelectedDays(new Set());
      setDayAnchor(null);
      syncViewsFromRange(env.from, env.to);
      onApply({
        dateFrom: env.from,
        dateTo: env.to,
        datePeriods: periods.length > 1 ? periods : undefined
      });
      if (close) onClose();
    },
    [onApply, onClose, syncViewsFromRange]
  );

  const applyDiscreteDays = useCallback(
    (days: ReadonlySet<string>, close: boolean) => {
      if (days.size === 0) return;
      const periods = selectedDaysToPeriods(days);
      const env = envelopeFromPeriods(periods);
      if (!env) return;
      setDf(env.from);
      setDt(env.to);
      setDayAnchor(null);
      setSelectedMonths(new Set(monthsCoveredByRange(env.from, env.to)));
      syncViewsFromRange(env.from, env.to);
      onApply({
        dateFrom: env.from,
        dateTo: env.to,
        datePeriods: periods.length > 1 ? periods : undefined
      });
      if (close) onClose();
    },
    [onApply, onClose, syncViewsFromRange]
  );

  const applyContinuousRange = useCallback(
    (close: boolean) => {
      const n = normalizeDateRange(df, dt);
      if (!n.dateFrom || !parseYmd(n.dateFrom)) return;
      setDf(n.dateFrom);
      setDt(n.dateTo);
      setSelectedDays(new Set());
      setDayAnchor(null);
      setSelectedMonths(new Set(monthsCoveredByRange(n.dateFrom, n.dateTo)));
      syncViewsFromRange(n.dateFrom, n.dateTo);
      onApply({ dateFrom: n.dateFrom, dateTo: n.dateTo, datePeriods: undefined });
      if (close) onClose();
    },
    [df, dt, onApply, onClose, syncViewsFromRange]
  );

  /** Avvalgidek: ikki klik — uzluksiz oraliq. */
  const pickDayRange = useCallback(
    (iso: string) => {
      if (!dayAnchor) {
        setDayAnchor(iso);
        setDf(iso);
        setDt("");
        return;
      }
      const a = dayAnchor < iso ? dayAnchor : iso;
      const b = dayAnchor < iso ? iso : dayAnchor;
      setDf(a);
      setDt(b);
      setDayAnchor(null);
      setSelectedDays(new Set());
      setSelectedMonths(new Set(monthsCoveredByRange(a, b)));
      commitRange(a, b);
    },
    [dayAnchor, commitRange]
  );

  /** Yangi rejim: alohida kunlar (1, 5, 9…). */
  const toggleDay = useCallback((iso: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      const sorted = [...next].sort();
      if (sorted.length > 0) {
        setDf(sorted[0]!);
        setDt(sorted[sorted.length - 1]!);
      }
      return next;
    });
  }, []);

  const toggleMonth = useCallback(
    (monthIndex0: number) => {
      const key = ymIndex(pickYear, monthIndex0);
      setSelectedMonths((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [pickYear]
  );

  useEffect(() => {
    if (!autoSave) return;
    if (panelMode !== "days") return;
    const t = window.setTimeout(() => commitRange(df, dt), 400);
    return () => window.clearTimeout(t);
  }, [autoSave, df, dt, commitRange, panelMode]);

  const presets = useMemo(() => buildPresets(), []);
  const emptyDays = new Set<string>();

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        "w-max max-w-[min(628px,calc(100vw-1rem))]",
        isCalendarMode && "min-w-[min(100%,38rem)]"
      )}
    >
      <div
        className={cn(
          "flex flex-col sm:flex-row",
          isCalendarMode ? "sm:items-stretch" : "sm:items-start sm:justify-start"
        )}
      >
        <div
          className={cn(
            "space-y-2 border-border/50 p-2 sm:border-r",
            isCalendarMode
              ? "min-w-0 flex-1 sm:min-w-[min(100%,25.5rem)] sm:pr-2.5"
              : "w-max max-w-full shrink-0 sm:pr-2"
          )}
        >
          <p className="border-b border-border/40 pb-1.5 text-xs font-medium text-foreground">Период</p>

          {panelMode === "days" ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[0.65rem]">
                <span className="text-muted-foreground">Вручную:</span>
                <Input
                  type="date"
                  className="h-7 w-[8.75rem] text-[0.65rem]"
                  value={df ?? ""}
                  onChange={(e) => setDf(e.target.value)}
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="date"
                  className="h-7 w-[8.75rem] text-[0.65rem]"
                  value={dt ?? ""}
                  onChange={(e) => setDt(e.target.value)}
                />
              </div>

              <div className="scrollbar-none flex flex-row flex-nowrap items-start justify-center gap-2 overflow-x-auto pb-0.5">
                <MonthCalendar
                  year={viewLeft.y}
                  month={viewLeft.m}
                  selectedDays={emptyDays}
                  rangeFrom={df}
                  rangeTo={dt}
                  onPick={pickDayRange}
                  onShiftMonth={(delta) => setViewLeft((v) => shiftMonthYm(v.y, v.m, delta))}
                />
                <MonthCalendar
                  year={viewRight.y}
                  month={viewRight.m}
                  selectedDays={emptyDays}
                  rangeFrom={df}
                  rangeTo={dt}
                  onPick={pickDayRange}
                  onShiftMonth={(delta) => setViewRight((v) => shiftMonthYm(v.y, v.m, delta))}
                />
              </div>
              <p className="text-[0.6rem] leading-snug text-muted-foreground">
                Два клика — непрерывный интервал; второй можно не выбирать (один день). «Принять» —
                закрыть. Затем «Применить» в фильтре.
              </p>
            </>
          ) : panelMode === "daysPick" ? (
            <>
              <div className="scrollbar-none flex flex-row flex-nowrap items-start justify-center gap-2 overflow-x-auto pb-0.5">
                <MonthCalendar
                  year={viewLeft.y}
                  month={viewLeft.m}
                  selectedDays={selectedDays}
                  rangeFrom=""
                  rangeTo=""
                  onPick={toggleDay}
                  onShiftMonth={(delta) => setViewLeft((v) => shiftMonthYm(v.y, v.m, delta))}
                />
                <MonthCalendar
                  year={viewRight.y}
                  month={viewRight.m}
                  selectedDays={selectedDays}
                  rangeFrom=""
                  rangeTo=""
                  onPick={toggleDay}
                  onShiftMonth={(delta) => setViewRight((v) => shiftMonthYm(v.y, v.m, delta))}
                />
              </div>
              <p className="text-[0.6rem] leading-snug text-muted-foreground">
                Чистый выбор: клик — день вкл/выкл (например 1, 5, 9). С пропусками. «Принять» —
                закрыть, затем «Применить» в фильтре.
              </p>
            </>
          ) : (
            <MonthYearGrid
              year={pickYear}
              onYearChange={setPickYear}
              selectedMonths={selectedMonths}
              onToggleMonth={toggleMonth}
            />
          )}
        </div>

        <div
          className={cn(
            "w-full shrink-0 border-t border-border/50 px-2 pb-2 pt-2 sm:border-t-0 sm:border-l sm:pl-2 sm:pt-2",
            isCalendarMode ? "sm:w-[11.25rem]" : "sm:w-[10rem]"
          )}
        >
          <p className="mb-1 text-[0.65rem] font-medium text-muted-foreground">Быстрый выбор</p>
          <div className="flex flex-col gap-px">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="rounded px-1.5 py-1 text-left text-[0.65rem] text-foreground hover:bg-muted"
                onClick={() => {
                  setDf(p.from);
                  setDt(p.to);
                  setDayAnchor(null);
                  setSelectedDays(new Set());
                  setSelectedMonths(new Set(monthsCoveredByRange(p.from, p.to)));
                  setPanelMode("days");
                  syncViewsFromRange(p.from, p.to);
                  commitRange(p.from, p.to);
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-left text-[0.65rem] transition-colors",
                panelMode === "months" ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-muted"
              )}
              onClick={() => {
                setPanelMode("months");
                const f = parseYmd(df) ?? new Date();
                setPickYear(f.getFullYear());
                if (selectedMonths.size === 0 && df && dt) {
                  setSelectedMonths(new Set(monthsCoveredByRange(df, dt)));
                }
              }}
            >
              Выбрать месяц
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-left text-[0.65rem] transition-colors",
                panelMode === "days" ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-muted"
              )}
              onClick={() => {
                setPanelMode("days");
                setDayAnchor(null);
              }}
            >
              Выбрать дату
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-left text-[0.65rem] transition-colors",
                panelMode === "daysPick" ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-muted"
              )}
              onClick={() => {
                setPanelMode("daysPick");
                setDayAnchor(null);
                // Birinchi ochilish — toza tanlov (oldingi oraliq/oylar ko‘chirilmaydi)
                setSelectedDays(new Set());
              }}
            >
              Выбрать дни
            </button>
          </div>
        </div>
      </div>

      {panelMode === "months" ? (
        <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/30 px-2.5 py-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={selectedMonths.size === 0}
            onClick={() => applyMonthSelection(selectedMonths, true)}
          >
            Принять
          </Button>
        </div>
      ) : panelMode === "daysPick" ? (
        <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/30 px-2.5 py-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={selectedDays.size === 0}
            onClick={() => applyDiscreteDays(selectedDays, true)}
          >
            Принять
          </Button>
        </div>
      ) : !autoSave ? (
        <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/30 px-2.5 py-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={!df?.trim() && !dt?.trim()}
            onClick={() => applyContinuousRange(true)}
          >
            Принять
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type DateRangePopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Bo‘sh yoki `undefined` bo‘lmasin — ixtiyoriy, ichkarida `""` ga normalizatsiya */
  dateFrom?: string;
  dateTo?: string;
  datePeriods?: DatePeriod[] | null;
  onApply: (next: { dateFrom: string; dateTo: string; datePeriods?: DatePeriod[] }) => void;
  /** Tanlovni darhol `onApply` ga uzatadi; pastdagi «Применить» tugmasi ko‘rinmaydi */
  autoSave?: boolean;
};

export function DateRangePopover({
  open,
  onOpenChange,
  anchorRef,
  dateFrom,
  dateTo,
  datePeriods,
  onApply,
  autoSave = false
}: DateRangePopoverProps) {
  const safeFrom = dateFrom ?? "";
  const safeTo = dateTo ?? "";
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const measured = panelRef.current?.getBoundingClientRect().width ?? 0;
    const panelW = measured > 48 ? measured : Math.min(628, vw - 16);
    let left = r.right - panelW;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = Math.max(8, vw - 8 - panelW);
    let top = r.bottom + 6;
    const maxH = Math.max(180, vh - top - 10);
    if (top + maxH > vh - 8) {
      top = Math.max(8, r.top - 8 - Math.min(maxH, vh * 0.85));
    }
    setBox({ top, left });
  }, [open, anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => reposition());
    });
    return () => cancelAnimationFrame(id);
  }, [open, reposition, safeFrom, safeTo, datePeriods]);

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
  }, [open, onOpenChange, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className="scrollbar-none fixed z-[100] w-max max-w-[min(628px,calc(100vw-1rem))] max-h-[min(85vh,calc(100vh-1rem))] overflow-y-auto overflow-x-auto rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5"
      style={{
        top: box.top,
        left: box.left
      }}
    >
      <DateRangePanel
        key={open ? "open" : "closed"}
        dateFrom={safeFrom}
        dateTo={safeTo}
        datePeriods={datePeriods}
        onApply={onApply}
        onClose={() => onOpenChange(false)}
        autoSave={autoSave}
      />
    </div>,
    document.body
  );
}
