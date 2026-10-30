import type { QueryClient } from "@tanstack/react-query";
import { previewReturnFilterSettings, type ReturnFilterSettingsDraft } from "./return-filter-settings-preview";

export type ReturnFilterSettings = ReturnFilterSettingsDraft;

export type ReturnFilterModeId = "period_only" | "balance_zero_only" | "both" | "none";

export const RETURN_FILTER_PROFILE_QUERY_KEY = "settings-profile-return-filter" as const;

export function returnFilterProfileQueryKey(tenantSlug: string | null | undefined) {
  return [RETURN_FILTER_PROFILE_QUERY_KEY, tenantSlug] as const;
}

export const RETURN_FILTER_MODE_PRESETS: Array<{
  id: ReturnFilterModeId;
  label: string;
  short: string;
  settings: ReturnFilterSettings;
}> = [
  {
    id: "period_only",
    label: "Режим 1 — только период",
    short: "Рекомендуется",
    settings: {
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: false
    }
  },
  {
    id: "balance_zero_only",
    label: "Режим 2 — только баланс 0",
    short: "После точки закрытия",
    settings: {
      period_enabled: false,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: true
    }
  },
  {
    id: "both",
    label: "Режим 3 — период + баланс 0",
    short: "Самый строгий",
    settings: {
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: true
    }
  },
  {
    id: "none",
    label: "Режим 4 — без фильтра",
    short: "Осторожно",
    settings: {
      period_enabled: false,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: false
    }
  }
];

export function detectReturnFilterMode(s: ReturnFilterSettings): ReturnFilterModeId {
  if (s.period_enabled && s.balance_zero_enabled) return "both";
  if (s.period_enabled) return "period_only";
  if (s.balance_zero_enabled) return "balance_zero_only";
  return "none";
}

export function previewForSettings(s: ReturnFilterSettings) {
  return previewReturnFilterSettings(s);
}

/** Sozlamalar saqlangach — po zakaz / erkin qaytarish cache yangilanadi. */
export async function invalidateReturnFilterCaches(
  qc: QueryClient,
  tenantSlug: string | null | undefined
): Promise<void> {
  await qc.invalidateQueries({ queryKey: returnFilterProfileQueryKey(tenantSlug) });
  await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
  await qc.invalidateQueries({ queryKey: ["order-create-polki-order-balances"] });
  await qc.invalidateQueries({ queryKey: ["order-create-polki-context"] });
  await qc.invalidateQueries({ queryKey: ["order-create-polki-orders"] });
}
