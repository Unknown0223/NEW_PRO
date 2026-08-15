import type { Prisma } from "@prisma/client";
import { asRecord } from "../tenant-settings/tenant-settings.shared";

/**
 * Oy o‘rtasida ishchi o‘rin almashinuvida KPI/plan ulushi.
 * Reja (odat): oy boshida turgan agent — FULL; yangi — qolgan kunlar pro-rata.
 */
export const SLOT_PLAN_POLICIES = [
  "full_for_starter_prorata_for_new",
  "prorata_both",
  "full_both"
] as const;

export type SlotPlanPolicy = (typeof SLOT_PLAN_POLICIES)[number];

export const DEFAULT_SLOT_PLAN_POLICY: SlotPlanPolicy = "full_for_starter_prorata_for_new";

export type SlotOccupancySegment = {
  started_at: Date;
  ended_at: Date | null;
};

export function isSlotPlanPolicy(v: unknown): v is SlotPlanPolicy {
  return typeof v === "string" && (SLOT_PLAN_POLICIES as readonly string[]).includes(v);
}

/** `tenant.settings.work_slots.plan_policy` */
export function readSlotPlanPolicy(settings: Prisma.JsonValue | Record<string, unknown> | null | undefined): SlotPlanPolicy {
  const root = asRecord(settings);
  const ws = asRecord(root.work_slots);
  const raw = ws.plan_policy;
  return isSlotPlanPolicy(raw) ? raw : DEFAULT_SLOT_PLAN_POLICY;
}

export function patchSlotPlanPolicyIntoSettings(
  settings: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  plan_policy: SlotPlanPolicy
): Record<string, unknown> {
  const root = { ...asRecord(settings) };
  const ws = { ...asRecord(root.work_slots), plan_policy };
  root.work_slots = ws;
  return root;
}

function dayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDayKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

/** Kun segment ichidami (oy chegarasi allaqachon kesilgan bo‘lishi mumkin). */
export function dayKeyInOccupancy(dayKey: string, seg: SlotOccupancySegment): boolean {
  const t = parseDayKey(dayKey).getTime();
  const startKey = dayKeyUTC(seg.started_at);
  if (dayKey < startKey) return false;
  if (seg.ended_at == null) return true;
  // ended_at kuni — ishlagan (chiqish kuni hali hisoblanadi); keyingi kunlardan blok.
  const endKey = dayKeyUTC(seg.ended_at);
  return dayKey <= endKey;
}

export function filterWorkingDaysInOccupancy(
  workingDayKeys: string[],
  segments: SlotOccupancySegment[]
): string[] {
  if (segments.length === 0) return workingDayKeys;
  return workingDayKeys.filter((d) => segments.some((s) => dayKeyInOccupancy(d, s)));
}

/** Oy boshida (monthStart kuni) slotda bo‘lganmi. */
export function wasStarterOnMonth(
  segments: SlotOccupancySegment[],
  monthStart: Date,
  monthEnd: Date
): boolean {
  const monthStartKey = dayKeyUTC(monthStart);
  for (const seg of segments) {
    if (seg.started_at >= monthEnd) continue;
    if (seg.ended_at != null && seg.ended_at < monthStart) continue;
    const startKey = dayKeyUTC(seg.started_at);
    if (startKey <= monthStartKey && dayKeyInOccupancy(monthStartKey, seg)) return true;
  }
  return false;
}

export type PlanShareResult = {
  /** 0..1 — `rawPlan * share` = samarali oy rejasi */
  share: number;
  role: "unaffected" | "starter" | "incoming" | "occupant";
  occupied_working_days: number;
  total_working_days: number;
  working_days_for_route: string[];
};

/**
 * Slot bandligi + siyosat bo‘yicha plan ulushi.
 * Segment yo‘q → slot ta’siri yo‘q (`share=1`, barcha ish kunlari).
 */
export function resolveSlotPlanShare(opts: {
  policy: SlotPlanPolicy;
  monthStart: Date;
  monthEnd: Date;
  workingDayKeys: string[];
  segments: SlotOccupancySegment[];
}): PlanShareResult {
  const { policy, monthStart, monthEnd, workingDayKeys, segments } = opts;
  const total = workingDayKeys.length;

  if (segments.length === 0 || total === 0) {
    return {
      share: 1,
      role: "unaffected",
      occupied_working_days: total,
      total_working_days: total,
      working_days_for_route: workingDayKeys
    };
  }

  const occupiedKeys = filterWorkingDaysInOccupancy(workingDayKeys, segments);
  const occupied = occupiedKeys.length;
  const prorata = occupied / total;
  const starter = wasStarterOnMonth(segments, monthStart, monthEnd);

  if (policy === "full_both") {
    return {
      share: 1,
      role: starter ? "starter" : "incoming",
      occupied_working_days: occupied,
      total_working_days: total,
      working_days_for_route: workingDayKeys
    };
  }

  if (policy === "prorata_both") {
    return {
      share: prorata,
      role: "occupant",
      occupied_working_days: occupied,
      total_working_days: total,
      working_days_for_route: occupiedKeys
    };
  }

  // full_for_starter_prorata_for_new (default)
  if (starter) {
    return {
      share: 1,
      role: "starter",
      occupied_working_days: occupied,
      total_working_days: total,
      working_days_for_route: workingDayKeys
    };
  }

  return {
    share: prorata,
    role: "incoming",
    occupied_working_days: occupied,
    total_working_days: total,
    working_days_for_route: occupiedKeys
  };
}

export function applyPlanShare(rawPlan: number, share: number): number {
  if (!Number.isFinite(rawPlan) || rawPlan === 0) return 0;
  if (!Number.isFinite(share) || share >= 1) return rawPlan;
  if (share <= 0) return 0;
  return Math.round(rawPlan * share * 100) / 100;
}
