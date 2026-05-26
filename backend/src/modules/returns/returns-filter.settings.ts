import { prisma } from "../../config/database";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import type { ReturnFilterPeriodUnit, ReturnFilterSettings } from "./returns-filter.types";

export const DEFAULT_RETURN_FILTER_SETTINGS: ReturnFilterSettings = {
  period_enabled: true,
  period_unit: "day",
  period_value: 30,
  balance_zero_enabled: false
};

function parsePeriodUnit(raw: unknown): ReturnFilterPeriodUnit {
  return raw === "month" ? "month" : "day";
}

function parsePeriodValue(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_RETURN_FILTER_SETTINGS.period_value;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

export function normalizeReturnFilterSettings(raw: unknown): ReturnFilterSettings {
  const src = asRecord(raw);
  return {
    period_enabled:
      src.period_enabled === undefined
        ? DEFAULT_RETURN_FILTER_SETTINGS.period_enabled
        : Boolean(src.period_enabled),
    period_unit: parsePeriodUnit(src.period_unit),
    period_value: parsePeriodValue(src.period_value),
    balance_zero_enabled: Boolean(src.balance_zero_enabled)
  };
}

export async function loadReturnFilterSettings(tenantId: number): Promise<ReturnFilterSettings> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  return normalizeReturnFilterSettings(st.return_filter);
}

export function returnFilterSettingsToDto(settings: ReturnFilterSettings): ReturnFilterSettings {
  return { ...settings };
}
