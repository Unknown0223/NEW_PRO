import type { Prisma } from "@prisma/client";

export type IncomeReportQuery = {
  from: string;
  to: string;
  request_type?: "regular" | "consignment" | "all";
  expeditor_id?: number;
  agent_id?: number;
  cash_desk_id?: number;
  client_category?: string;
  payment_type?: string;
  trade_direction?: string;
  territory_1?: string;
  territory_2?: string;
  territory_3?: string;
};

export type AccessCtx = {
  userId: number | null;
  role: string;
};

export type IncomeRow = {
  payment_type: string;
  amount: Prisma.Decimal;
  territory_1: string | null;
  territory_2: string | null;
  territory_3: string | null;
  client_id: number;
  client_name: string;
  agent_id: number | null;
  agent_name: string | null;
};

export const KNOWN_SUMMARY_KEYS = ["Naqd", "Pereches", "SET", "Terminal", "Эски карздан кирим"];

export function parseDate(raw: string | undefined, fallback: string): Date {
  const d = new Date(raw?.trim() || fallback);
  if (Number.isNaN(d.getTime())) throw new Error("BAD_DATE");
  return d;
}
