import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import type { TerritoryNode } from "@/lib/territory-tree";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { CSSProperties } from "react";

export function normTrim(s: string): string {
  return String(s ?? "").trim();
}

export function joinCsv(values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  const set = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) set.add(t);
  }
  return Array.from(set).join(",");
}

export function uniqSorted(values: string[]): string[] {
  const s = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) s.add(t);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
}

export function collectCascadeFromTreeMulti(
  nodes: TerritoryNode[] | undefined,
  selectedZonesRaw: string[] | undefined,
  selectedRegionsRaw: string[] | undefined
): { zones: string[]; regions: string[]; cities: string[] } {
  const selectedZones = new Set((selectedZonesRaw ?? []).map(normTrim).filter(Boolean));
  const selectedRegions = new Set((selectedRegionsRaw ?? []).map(normTrim).filter(Boolean));
  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();
  const zoneOk = (z: string) => selectedZones.size === 0 || selectedZones.has(z);
  const regionOk = (r: string) => selectedRegions.size === 0 || selectedRegions.has(r);

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = normTrim(n.name);
      if (!name) continue;
      const nextPath = [...path, name];
      if (depth === 0) zones.add(name);
      if (depth === 1) {
        const z = nextPath[0] ?? "";
        if (zoneOk(z)) regions.add(name);
      }
      if (depth === 2) {
        const z = nextPath[0] ?? "";
        const r = nextPath[1] ?? "";
        if (zoneOk(z) && regionOk(r)) cities.add(name);
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };

  walk(nodes ?? [], 0, []);
  return { zones: uniqSorted([...zones]), regions: uniqSorted([...regions]), cities: uniqSorted([...cities]) };
}

export function fmtMoney(v: string | number): string {
  return formatNumberGrouped(v, { minFractionDigits: 2, maxFractionDigits: 2 });
}

export function fmtCount(v: string | number): string {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

export function fmtQty(v: string | number | undefined): string {
  if (v == null || v === "") return "—";
  return formatNumberGrouped(v, { minFractionDigits: 0, maxFractionDigits: 3 });
}

export function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

export function num(v: string | number): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function executionClass(pctVal: number | null | undefined): string {
  if (pctVal == null || !Number.isFinite(pctVal)) return "text-muted-foreground";
  if (pctVal >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (pctVal >= 80) return "text-slate-600 dark:text-slate-300";
  if (pctVal >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function coverageClass(pctVal: number): string {
  if (pctVal >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (pctVal >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function growthClass(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "text-muted-foreground";
  if (p >= 15) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 0) return "text-slate-600 dark:text-slate-300";
  return "text-red-600 dark:text-red-400";
}

export function matrixCellHeatStyle(value: number, rowMax: number, globalMax: number): CSSProperties {
  if (value <= 0) return {};
  const denom = Math.max(globalMax, rowMax, 1e-9);
  const r = Math.min(1, value / denom);
  return { backgroundColor: `hsl(152 55% 36% / ${0.07 + r * 0.34})` };
}

export function matrixDayHeaderParts(day: string): { ddmm: string; weekday: string } {
  if (day.length >= 10) {
    const y = day.slice(0, 4);
    const m = day.slice(5, 7);
    const d = day.slice(8, 10);
    const dt = new Date(`${y}-${m}-${d}T12:00:00`);
    const weekday =
      Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("ru-RU", { weekday: "short" }) : "";
    return { ddmm: `${d}.${m}`, weekday };
  }
  return { ddmm: day, weekday: "" };
}

export function skuNeedsAttention(r: MonitoringSnapshot["sku_matrix"][number]): boolean {
  const ret = r.return_pct ?? 0;
  const can = r.cancel_pct ?? 0;
  return ret >= 5 || can >= 12;
}

export function formatMonthYearRu(month: number, year: number): string {
  const m = Math.min(12, Math.max(1, month));
  const y = Math.max(2000, Math.min(2100, year));
  const d = new Date(y, m - 1, 1);
  if (!Number.isFinite(d.getTime())) return `${m} · ${y}`;
  const s = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function addCalendarMonths(y: number, month1to12: number, delta: number): { year: number; month: number } {
  const d = new Date(y, month1to12 - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthYearFromEndMinusDays(span: number): { year: number; month: number } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (span - 1));
  return { year: start.getFullYear(), month: start.getMonth() + 1 };
}

export function defaultMonitoringDraft(supervisorId = ""): import("@/components/dashboard/monitoring/types").MonitoringDraft {
  const d = new Date();
  return {
    month: d.getMonth() + 1,
    year: d.getFullYear(),
    branch_codes: [],
    territory_tree_node_ids: [],
    territory_ids: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    payment_methods: [],
    order_statuses: [],
    category_ids: []
  };
}

export function decodeAccessTokenSub(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    const id = Number.parseInt(String(json.sub ?? ""), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export const ORDER_STATUS_OPTIONS = [
  { value: "", label: "Все (кроме отмен/возвратов)" },
  { value: "new", label: "Новый" },
  { value: "confirmed", label: "Подтверждён" },
  { value: "picking", label: "Комплектация" },
  { value: "delivering", label: "Доставка" },
  { value: "delivered", label: "Доставлен" },
  { value: "cancelled", label: "Отменён" },
  { value: "returned", label: "Возврат" }
] as const;
