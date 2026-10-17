import { formatNumberGrouped } from "@/lib/format-numbers";

export type ConsignmentLimitAgent = {
  id: number;
  code: string | null;
  work_slot_code: string | null;
  name: string;
  consignment: boolean;
  consignment_limit_amount: string | null;
  supervisor_user_id: number | null;
  supervisor_name: string | null;
  outstanding_debt: string;
  remaining_limit: string | null;
};

export type ConsignmentSupervisor = { id: number; fio: string };

export const NO_SUPERVISOR = "__no_sup__";

export function toNum(raw: string | null | undefined): number {
  const n = Number.parseFloat(String(raw ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function sum(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  return `${formatNumberGrouped(raw, { maxFractionDigits: 2 })} сум`;
}

export function supervisorQuery(supervisor: string): string {
  if (supervisor === NO_SUPERVISOR) return "agents_without_supervisor=1";
  return supervisor ? `supervisor_user_id=${encodeURIComponent(supervisor)}` : "";
}

export function agentLabel(a: Pick<ConsignmentLimitAgent, "name" | "code" | "work_slot_code">): string {
  const code = a.work_slot_code ?? a.code;
  return code ? `${a.name} · ${code}` : a.name;
}

export function shiftYm(ym: { year: number; month: number }, delta: number) {
  const idx = ym.year * 12 + ym.month - 1 + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function ymKey(ym: { year: number; month: number }): string {
  return `${ym.year}-${String(ym.month).padStart(2, "0")}`;
}
