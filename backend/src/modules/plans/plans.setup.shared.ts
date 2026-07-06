import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type PlanningDirection = { id: number; name: string; code: string | null };
export type PlanningKpiGroup = {
  id: number;
  name: string;
  trade_direction_id: number;
  status: string | null;
};
export type PlanningEmployee = {
  id: number;
  name: string;
  code: string | null;
  role: string;
  parent_id: number | null;
  supervisor_config_index: number | null;
  chain_level: number | null;
};
export type PlanningPlan = {
  id: number;
  month: number;
  year: number;
  trade_direction_id: number;
  kpi_group_id: number;
  status: string;
};
export type PlanningTarget = {
  id: number;
  plan_id: number;
  user_id: number;
  cost: string;
  count: string;
  volume: string;
  acb: string;
  order_count: number;
  comment: string | null;
  status: string;
  updated_at: string;
};

export type PlanningCenterData = {
  trade_directions: PlanningDirection[];
  kpi_groups: PlanningKpiGroup[];
  employees: PlanningEmployee[];
  plans: PlanningPlan[];
  kpi_targets: PlanningTarget[];
};

export type UserRow = {
  id: number;
  name: string;
  login: string;
  role: string;
  code: string | null;
  supervisor_user_id: number | null;
  trade_direction_id: number | null;
  trade_direction: string | null;
};

export const USER_SELECT = {
  id: true,
  name: true,
  login: true,
  role: true,
  code: true,
  supervisor_user_id: true,
  trade_direction_id: true,
  trade_direction: true
} as const;

export function personName(u: { name: string; login: string }): string {
  const n = (u.name ?? "").trim();
  return n.length > 0 ? n : u.login;
}

export function dec(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

export function parseDecimalInput(v: string | number | undefined): Prisma.Decimal | undefined {
  if (v === undefined) return undefined;
  const normalized = String(v).replace(/\s/g, "").replace(/,/g, ".");
  if (normalized.trim() === "") return new Prisma.Decimal(0);
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) throw new Error("BAD_DECIMAL");
  return new Prisma.Decimal(n);
}

export async function getDirection(
  tenantId: number,
  directionId: number
): Promise<PlanningDirection | null> {
  const row = await prisma.tradeDirection.findFirst({
    where: { id: directionId, tenant_id: tenantId, is_active: true },
    select: { id: true, name: true, code: true }
  });
  return row ? { id: row.id, name: row.name, code: row.code ?? null } : null;
}
