import type { ProposalController } from "@taklifiy/hooks/use-proposal";

export function todayPeriodKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function kpiLabel(c: ProposalController, id: number): string {
  const name = c.liveMeta?.kpiGroups.find((g) => g.id === id)?.name;
  return name ?? `KPI ${id}`;
}

export function directionLabel(c: ProposalController, id: number): string {
  const name = c.liveMeta?.directions.find((d) => d.id === id)?.name;
  return name ?? `Yo‘nalish ${id}`;
}
