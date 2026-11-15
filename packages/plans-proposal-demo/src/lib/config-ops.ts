import {
  DEFAULT_CONFIG,
  cloneConfig,
  type Formula,
  type ManualTarget,
  type ProposalConfig
} from "@salec/plans-proposal";
import type { ConfigMap } from "./selection";

/** Konfiguratsiyani o‘zgartirmasdan yangi ConfigMap qaytaradigan sof funksiyalar. */
export function withConfig(
  configs: ConfigMap,
  kpiGroupId: number,
  update: (draft: ProposalConfig) => void
): ConfigMap {
  const next = { ...configs };
  const draft = cloneConfig(configs[String(kpiGroupId)] ?? DEFAULT_CONFIG);
  update(draft);
  next[String(kpiGroupId)] = draft;
  return next;
}

export function withAllConfigs(
  configs: ConfigMap,
  update: (draft: ProposalConfig) => void
): ConfigMap {
  const next: ConfigMap = {};
  for (const [key, value] of Object.entries(configs)) {
    const draft = cloneConfig(value);
    update(draft);
    next[key] = draft;
  }
  return next;
}

export function withCellFormula(
  configs: ConfigMap,
  kpiGroupId: number,
  key: string,
  formula: Formula | null
): ConfigMap {
  return withConfig(configs, kpiGroupId, (d) => {
    d.cellFormulas ??= {};
    if (formula) d.cellFormulas[key] = formula;
    else delete d.cellFormulas[key];
  });
}

export function withManual(
  configs: ConfigMap,
  kpiGroupId: number,
  key: string,
  manual: ManualTarget | null
): ConfigMap {
  return withConfig(configs, kpiGroupId, (d) => {
    if (manual) {
      d.overrides[key] = manual;
      d.excluded = d.excluded.filter((k) => k !== key);
    } else delete d.overrides[key];
  });
}

export function withExcluded(configs: ConfigMap, kpiGroupId: number, key: string): ConfigMap {
  return withConfig(configs, kpiGroupId, (d) => {
    d.excluded = d.excluded.includes(key)
      ? d.excluded.filter((k) => k !== key)
      : [...d.excluded, key];
  });
}
