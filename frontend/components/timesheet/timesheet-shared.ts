import type { LucideIcon } from "lucide-react";
import { Bot, MapPin, PenLine, Smartphone } from "lucide-react";

/**
 * Полная модель статусов посещаемости (паритет с прототипом TabelERP):
 *  worked=1 · half_day=0.5 · absent=0 · holiday(выходной) · vacation(отпуск) ·
 *  sick(больничный) · trip(командировка).
 */
export type AttendanceStatus = "worked" | "half_day" | "absent" | "vacation" | "sick" | "holiday" | "trip";
export type Source = "manual" | "gps" | "mobile_login" | "auto";

/** Легенда / порядок статусов (как в прототипе: 0, 0.5, 1, выходной, отпуск, больничный, командировка). */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "absent",
  "half_day",
  "worked",
  "holiday",
  "vacation",
  "sick",
  "trip"
];

/** «Рабочие» значения для быстрого выбора 0 / 0.5 / 1. */
export const WORK_VALUES = [0, 0.5, 1] as const;
export type WorkValue = (typeof WORK_VALUES)[number];

export const WORK_STATUS_BY_VALUE: Record<string, AttendanceStatus> = {
  "0": "absent",
  "0.5": "half_day",
  "1": "worked"
};

/** Специальные статусы (не рабочее значение). */
export const SPECIAL_STATUSES: AttendanceStatus[] = ["holiday", "vacation", "sick", "trip"];

/** Вклад статуса в «Итого». */
export function statusWorkValue(s: AttendanceStatus): number {
  if (s === "worked") return 1;
  if (s === "half_day") return 0.5;
  return 0;
}

export function isWorkStatus(s: AttendanceStatus): boolean {
  return s === "worked" || s === "half_day" || s === "absent";
}

/** Форматирование дробного «Итого» (0.5 → «0.5», 3 → «3»). */
export function fmtTotal(t: number): string {
  return t % 1 ? t.toFixed(1) : String(t);
}

/** Роли, которым backend разрешает редактировать табель (ADMIN_AND_OPERATOR_LIKE_ROLES). */
export const TIMESHEET_EDIT_ROLES = new Set([
  "admin",
  "operator",
  "director",
  "sales_director",
  "manager",
  "regional_manager",
  "accountant",
  "warehouse_manager"
]);

export function canEditTimesheet(role: string | null | undefined): boolean {
  return Boolean(role && TIMESHEET_EDIT_ROLES.has(role));
}

export type TimesheetCell = { day: number; date: string; status: AttendanceStatus; source: Source };

export type TimesheetRow = {
  user_id: number;
  fio: string;
  role: string;
  login: string;
  worked_days: number;
  absent_days: number;
  cells: TimesheetCell[];
  /** Slotdan chiqish sanasi — shu kundan keyin tahrir bloklangan. */
  slot_left_at?: string | null;
  /** Oy ichida slotdan chiqqan (jamoa pastida, qizil). */
  is_departed?: boolean;
};

/** Chiqish sanasidan keyingi kunmi. */
export function isAfterSlotLeave(row: TimesheetRow, date: string): boolean {
  const left = row.slot_left_at;
  return Boolean(left && date > left);
}

export type StatusMeta = {
  /** Числовой код (0 / 0.5 / 1 / 2..5) — для экспорта и подсказок. */
  code: string;
  /** Буква/символ в ячейке. */
  short: string;
  /** Полное русское название. */
  label: string;
  /** HEX-цвет (для инлайновых стилей спец-статусов). */
  color: string;
  /** Цвет точки в легенде. */
  dot: string;
  /** Классы для ячейки таблицы. */
  cell: string;
  /** Классы для активной кнопки-чипа выбора статуса. */
  chipActive: string;
};

export const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  // Цвета ячеек соответствуют прототипу TabelERP (ZIP):
  //  1 — сплошной teal, 0.5 — светлый teal, 0 — серый (НЕ teal!),
  //  спец-статусы — сплошные цвета (синий / жёлтый / оранжевый / фиолетовый).
  worked: {
    code: "1",
    short: "1",
    label: "Работал",
    color: "#0e8c7a",
    // Фиксированный фирменный teal (ZIP brand-600) — не зависит от палитры SALEC.
    dot: "bg-[#0e8c7a]",
    cell: "bg-[#0e8c7a] text-white",
    chipActive: "bg-[#0e8c7a] text-white border-[#0e8c7a]"
  },
  half_day: {
    code: "0.5",
    short: "0.5",
    label: "Полдня",
    color: "#5eead4",
    dot: "bg-teal-300",
    cell: "bg-teal-200 text-teal-900 dark:bg-teal-400/80 dark:text-teal-950",
    chipActive: "bg-[#0e8c7a] text-white border-[#0e8c7a]"
  },
  absent: {
    code: "0",
    short: "0",
    label: "Отсутствовал",
    color: "#94a3b8",
    dot: "bg-slate-400",
    cell: "bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300",
    chipActive: "bg-[#0e8c7a] text-white border-[#0e8c7a]"
  },
  holiday: {
    code: "2",
    short: "В",
    label: "Выходной",
    color: "#3b82f6",
    dot: "bg-blue-500",
    cell: "bg-blue-500 text-white dark:bg-blue-500",
    chipActive: "bg-blue-500 text-white border-blue-500"
  },
  vacation: {
    code: "3",
    short: "О",
    label: "Отпуск",
    color: "#eab308",
    dot: "bg-yellow-400",
    cell: "bg-yellow-400 text-yellow-950 dark:bg-yellow-400 dark:text-yellow-950",
    chipActive: "bg-yellow-400 text-yellow-950 border-yellow-400"
  },
  sick: {
    code: "4",
    short: "Б",
    label: "Больничный",
    color: "#f97316",
    dot: "bg-orange-500",
    cell: "bg-orange-500 text-white dark:bg-orange-500",
    chipActive: "bg-orange-500 text-white border-orange-500"
  },
  trip: {
    code: "5",
    short: "К",
    label: "Командировка",
    color: "#a855f7",
    dot: "bg-purple-500",
    cell: "bg-purple-500 text-white dark:bg-purple-500",
    chipActive: "bg-purple-500 text-white border-purple-500"
  }
};

export function statusMeta(s: AttendanceStatus): StatusMeta {
  return STATUS_META[s];
}

export const SOURCE_META: Record<Source, { label: string; icon: LucideIcon }> = {
  manual: { label: "Ручной ввод", icon: PenLine },
  gps: { label: "GPS-визит", icon: MapPin },
  mobile_login: { label: "Вход в приложение", icon: Smartphone },
  auto: { label: "Автоматически", icon: Bot }
};

export const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

/** Короткие названия дней недели (Вс..Сб), индекс = getUTCDay(). */
export const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function monthNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split("-").map((x) => Number.parseInt(x, 10));
  return { year: y, month: m };
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: m } = parseMonth(month);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function fmtMonthLabel(month: string): string {
  const { year, month: m } = parseMonth(month);
  return `${MONTH_NAMES_RU[m - 1] ?? m} ${year}`;
}

/** День недели (0=Вс..6=Сб) для даты YYYY-MM-DD в UTC. */
export function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
}

export function isSunday(dateIso: string): boolean {
  return weekdayOf(dateIso) === 0;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Опорный день для статистики (как в прототипе — «на день», а не сумма за месяц):
 * текущий месяц → сегодня; иначе последний день месяца.
 */
export function referenceDate(month: string, days: number[]): string {
  const today = todayIso();
  if (today.startsWith(month)) return today;
  const last = days.length ? days[days.length - 1] : 1;
  return `${month}-${String(last).padStart(2, "0")}`;
}

/** Дата YYYY-MM-DD → DD.MM.YYYY. */
export function fmtRuDate(dateIso: string): string {
  const [y, m, d] = dateIso.split("-");
  return `${d}.${m}.${y}`;
}

export function initialsOf(fio: string): string {
  return fio
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/** Экспорт матрицы табеля в CSV (разделитель «;», BOM для Excel). mode: коды 0–5 или текст. */
export function exportTimesheetCsv(month: string, days: number[], rows: TimesheetRow[], mode: "codes" | "labels" = "codes") {
  const dayCols = days.map((d) => String(d).padStart(2, "0"));
  const head = ["ФИО", "Роль", "Логин", "Итого", ...dayCols];
  const lines = rows.map((r) => {
    const total = r.cells.reduce((acc, c) => acc + statusWorkValue(c.status), 0);
    return [
      r.fio,
      r.role,
      r.login,
      fmtTotal(total),
      ...r.cells.map((c) => (mode === "codes" ? STATUS_META[c.status].short : STATUS_META[c.status].label))
    ];
  });
  const csv = [head, ...lines].map((x) => x.map((y) => `"${String(y).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
