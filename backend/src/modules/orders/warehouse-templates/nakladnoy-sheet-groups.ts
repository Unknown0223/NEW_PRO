import type {
  NakladnoyBuildOptions,
  NakladnoyGroupBy,
  NakladnoyOrderPayload
} from "../order-nakladnoy-xlsx.types";
import { groupKeyForOrder } from "../order-nakladnoy-xlsx.format";

export type NakladnoySheetGroup = {
  key: string;
  label: string;
  orders: NakladnoyOrderPayload[];
};

const EMPTY_LABEL: Record<NakladnoyGroupBy, string> = {
  expeditor: "Без экспедитора",
  agent: "Без агента",
  territory: "Без территории"
};

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** `[NAVOI] ABDURAHMONOV HIKMATILLO (28.04.2026) 99890…` → `NAVOI ABDURAHMONOV HIKMATILLO` */
export function expeditorSheetLabel(o: NakladnoyOrderPayload): string {
  const raw = (o.expeditorLine ?? "").replace(/\s*\(\s*\d{2}\.\d{2}\.\d{4}\s*\).*$/, "");
  const label = squash(raw.replace(/[[\]]/g, " "));
  if (label && label !== "—") return label;
  return squash(o.expeditorName ?? "");
}

/** `A-01 - [Ali Valiyev] 01/02/26` → `A-01 - Ali Valiyev` */
export function agentSheetLabel(o: NakladnoyOrderPayload): string {
  const raw = (o.agentLine ?? "").replace(/\s+\d{2}\/\d{2}\/\d{2,4}\s*$/, "");
  const label = squash(raw.replace(/[[\]]/g, " "));
  if (label && label !== "—") return label;
  return squash(o.agentName ?? "");
}

export function sheetGroupLabel(o: NakladnoyOrderPayload, by: NakladnoyGroupBy): string {
  if (by === "expeditor") {
    return (o.expeditorUserId != null && expeditorSheetLabel(o)) || EMPTY_LABEL.expeditor;
  }
  if (by === "agent") {
    return (o.agentId != null && agentSheetLabel(o)) || EMPTY_LABEL.agent;
  }
  const t = squash(o.territory ?? "");
  return t && t !== "—" ? t : EMPTY_LABEL.territory;
}

/**
 * «Отделить по листам» yoqilganda — экспедитор / агент / территория bo‘yicha guruhlar;
 * o‘chirilganda bitta guruh (barcha zakazlar bitta varaqda).
 */
export function splitOrdersIntoSheetGroups(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): NakladnoySheetGroup[] {
  if (orders.length === 0) return [];
  const by = options.groupBy;
  if (!options.separateSheets) {
    const labels = [...new Set(orders.map((o) => sheetGroupLabel(o, by)))];
    return [{ key: "all", label: labels.length === 1 ? labels[0]! : "Все", orders }];
  }
  const buckets = new Map<string, NakladnoySheetGroup>();
  for (const o of orders) {
    const key = groupKeyForOrder(o, by);
    const bucket = buckets.get(key);
    if (bucket) bucket.orders.push(o);
    else buckets.set(key, { key, label: sheetGroupLabel(o, by), orders: [o] });
  }
  return [...buckets.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ru", { numeric: true, sensitivity: "base" })
  );
}

/** Excel varaq nomi: `1.518.NAVOI ABDURAHMONOV HIKMA` (max 31 belgi). */
export function numberedSheetName(index: number, code: string, label: string): string {
  const safe = squash(label.replace(/[:\\/?*[\]]/g, " "));
  return `${index}.${code}.${safe}`.slice(0, 31);
}

export function uniqueSheetName(used: Set<string>, name: string): string {
  let candidate = name.slice(0, 31) || "Лист";
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = name.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** `5.1.8` → `518`, `4.0.1` → `401` */
export function layoutSheetCode(versionLabel: string): string {
  const digits = versionLabel.replace(/\D/g, "");
  return digits || versionLabel;
}

export function singleSheetOptions(options: NakladnoyBuildOptions): NakladnoyBuildOptions {
  return { ...options, separateSheets: false };
}
