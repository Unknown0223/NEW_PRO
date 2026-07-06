import type { AgentMobileConfigDraft } from "@/components/staff/agent-mobile-config-types";

const SECTION_KEYS = [
  "client",
  "gps",
  "outlet",
  "route",
  "product_list",
  "photo",
  "misc",
  "sync",
  "orders",
  "supervision",
  "van_selling"
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

function stableJson(v: unknown): string {
  return JSON.stringify(v ?? null);
}

function diffRecordSection<T extends Record<string, unknown>>(
  baseline: T | undefined,
  current: T | undefined
): Partial<T> | undefined {
  const base = (baseline ?? {}) as T;
  const cur = (current ?? {}) as T;
  const out: Partial<T> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(cur)]);
  for (const k of keys) {
    const bk = base[k as keyof T];
    const ck = cur[k as keyof T];
    if (stableJson(bk) !== stableJson(ck)) {
      out[k as keyof T] = ck;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Guruh saqlash: faqat o‘zgartirilgan bo‘limlar/kalitlar. */
export function diffMobileConfigDraft(
  baseline: AgentMobileConfigDraft,
  current: AgentMobileConfigDraft
): AgentMobileConfigDraft | null {
  const patch: AgentMobileConfigDraft = { schema_version: baseline.schema_version ?? 1 };
  let changed = false;

  for (const key of SECTION_KEYS) {
    const sectionDiff = diffRecordSection(
      baseline[key] as Record<string, unknown> | undefined,
      current[key] as Record<string, unknown> | undefined
    );
    if (sectionDiff) {
      (patch as Record<SectionKey, unknown>)[key] = sectionDiff;
      changed = true;
    }
  }

  return changed ? patch : null;
}

export function countMobileConfigPatchSections(patch: AgentMobileConfigDraft): number {
  return SECTION_KEYS.filter((k) => patch[k] != null).length;
}
