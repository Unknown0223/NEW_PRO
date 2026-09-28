import { workRegionTodayKey, WORK_REGION_UTC_OFFSET_HOURS } from "../mobile/mobile-agent-sync.config.service";
import {
  getWorkdaysStateCached,
  type ExceptionType,
  type Schedule,
  type WdRole,
  type WorkdaysState
} from "./workdays.service";

/** `users.role` → «Рабочие дни» jadvalidagi rol. Ro‘yxatda yo‘q rollar (admin va h.k.) cheklanmaydi. */
export const USER_ROLE_TO_WD_ROLE: Record<string, WdRole> = {
  agent: "Агент",
  cashier: "Кассир",
  manager: "Менеджер",
  merchandiser: "Мерчендайзер",
  operator: "Оператор",
  skladchik: "Складчик",
  supervisor: "Супервайзер",
  expeditor: "Экспедитор"
};

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const EXCEPTION_REASON: Record<ExceptionType, string> = {
  holiday: "Праздник",
  event: "Мероприятие компании",
  forced: "Обязательный рабочий день",
  training: "Обучение (тренинг)"
};
const NEXT_WORKDAY_SEARCH_DAYS = 62;

export type WorkdayAccessStatus = {
  restricted: boolean;
  allowed: boolean;
  role_label: string | null;
  today: string;
  reason: "schedule" | "exception" | null;
  reason_label: string | null;
  comment: string | null;
  /** YYYY-MM-DD — keyingi ish kuni (bloklanganda). */
  next_work_day: string | null;
  /** ISO — keyingi ish kunining boshlanishi (Asia/Tashkent 00:00). */
  next_work_start: string | null;
  seconds_until_start: number | null;
  message: string | null;
};

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function hasWorkday(s: Schedule | undefined | null): s is Schedule {
  return Array.isArray(s) && s.length === 7 && s.some(Boolean);
}

function dayStartIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(Date.UTC(y!, m! - 1, d!, -WORK_REGION_UTC_OFFSET_HOURS, 0, 0, 0)).toISOString();
}

function formatDayRu(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${WEEKDAY_SHORT[weekdayIndex(ymd)]}, ${d}.${m}.${y}`;
}

type DayDecision = { working: boolean; reason: "schedule" | "exception"; exceptionType?: ExceptionType; comment?: string };

/**
 * Ustuvorlik (web «Рабочие дни» bilan bir xil):
 * 1) sana istisnosi (rol yoki «Все роли»): праздник/мероприятие → dam, обязательный/тренинг → ish;
 * 2) xodimning individual grafigi;
 * 3) rol grafigi. Grafikda umuman ish kuni yo‘q bo‘lsa — cheklov qo‘llanmaydi.
 */
export function decideWorkday(
  state: WorkdaysState,
  wdRole: WdRole,
  ymd: string,
  userId: number | string
): DayDecision {
  const ex =
    state.exceptions.find((e) => e.date === ymd && e.role === wdRole) ??
    state.exceptions.find((e) => e.date === ymd && e.role === "ALL");
  if (ex) {
    const working = ex.type === "forced" || ex.type === "training";
    return { working, reason: "exception", exceptionType: ex.type, comment: ex.comment || undefined };
  }
  const override = state.overrides.find((o) => String(o.employeeId) === String(userId));
  const schedule = hasWorkday(override?.schedule) ? override!.schedule : state.schedules[wdRole];
  if (!hasWorkday(schedule)) return { working: true, reason: "schedule" };
  return { working: Boolean(schedule[weekdayIndex(ymd)]), reason: "schedule" };
}

export function computeWorkdayAccess(
  state: WorkdaysState,
  userRole: string,
  userId: number | string,
  now: Date = new Date()
): WorkdayAccessStatus {
  const today = workRegionTodayKey(now);
  const wdRole = USER_ROLE_TO_WD_ROLE[userRole];
  const base: WorkdayAccessStatus = {
    restricted: false,
    allowed: true,
    role_label: wdRole ?? null,
    today,
    reason: null,
    reason_label: null,
    comment: null,
    next_work_day: null,
    next_work_start: null,
    seconds_until_start: null,
    message: null
  };
  if (!wdRole || !state.enforce_access) return base;

  const decision = decideWorkday(state, wdRole, today, userId);
  if (decision.working) return { ...base, restricted: true };

  let next: string | null = null;
  for (let i = 1; i <= NEXT_WORKDAY_SEARCH_DAYS; i++) {
    const d = addDays(today, i);
    if (decideWorkday(state, wdRole, d, userId).working) {
      next = d;
      break;
    }
  }
  const nextStart = next ? dayStartIso(next) : null;
  const seconds = nextStart ? Math.max(0, Math.round((Date.parse(nextStart) - now.getTime()) / 1000)) : null;
  const reasonLabel =
    decision.reason === "exception" && decision.exceptionType
      ? EXCEPTION_REASON[decision.exceptionType]
      : "Выходной день по графику";
  const message =
    `Сегодня (${formatDayRu(today)}) — нерабочий день для роли «${wdRole}»: ${reasonLabel.toLowerCase()}. ` +
    "Доступ к системе закрыт по настройкам «Рабочие дни»." +
    (next ? ` Рабочий день начнётся ${formatDayRu(next)} в 00:00.` : "");

  return {
    ...base,
    restricted: true,
    allowed: false,
    reason: decision.reason,
    reason_label: reasonLabel,
    comment: decision.comment ?? null,
    next_work_day: next,
    next_work_start: nextStart,
    seconds_until_start: seconds,
    message
  };
}

export async function getWorkdayAccessStatus(
  tenantId: number,
  userRole: string,
  userId: number | string
): Promise<WorkdayAccessStatus> {
  if (!USER_ROLE_TO_WD_ROLE[userRole]) return computeWorkdayAccess(emptyState(), userRole, userId);
  const state = await getWorkdaysStateCached(tenantId);
  return computeWorkdayAccess(state, userRole, userId);
}

function emptyState(): WorkdaysState {
  return { schedules: {}, exceptions: [], overrides: [], enforce_access: false };
}

/** Bloklangan holatda ham ochiq qoladigan yo‘llar (sessiya, holat sahifasi). */
export function isWorkdayGuardExemptPath(url: string): boolean {
  const path = (url.split("?")[0] ?? "").replace(/\/+$/, "");
  return (
    path.endsWith("/me/workday-status") ||
    path.endsWith("/auth/logout") ||
    path.endsWith("/auth/me") ||
    path.endsWith("/auth/refresh")
  );
}
