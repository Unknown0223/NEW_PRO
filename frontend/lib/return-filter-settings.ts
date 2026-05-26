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
    label: "HOLAT 1 — faqat davr",
    short: "Tavsiya etiladi",
    settings: {
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: false
    }
  },
  {
    id: "balance_zero_only",
    label: "HOLAT 2 — faqat balans 0",
    short: "Yopilgan nuqtadan keyin",
    settings: {
      period_enabled: false,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: true
    }
  },
  {
    id: "both",
    label: "HOLAT 3 — davr + balans 0",
    short: "Eng qattiq",
    settings: {
      period_enabled: true,
      period_unit: "day",
      period_value: 7,
      balance_zero_enabled: true
    }
  },
  {
    id: "none",
    label: "HOLAT 4 — filtr yo‘q",
    short: "Ehtiyot",
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
