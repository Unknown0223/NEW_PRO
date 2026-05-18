import { Prisma } from "@prisma/client";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";

export type CashFlowMoney = { terminal: string; cash: string; total: string };

export type CashFlowTableChild = {
  key: string;
  label: string;
  terminal: string;
  cash: string;
  total: string;
};

export type CashFlowTableRow = {
  key: string;
  kind: "opening" | "income" | "expense" | "closing";
  label: string;
  terminal: string;
  cash: string;
  total: string;
  children: CashFlowTableChild[];
};

export type CashFlowReportPayload = {
  date_from: string;
  date_to: string;
  cash_desk: { id: number; name: string; code: string | null };
  summary: {
    opening: CashFlowMoney;
    income: CashFlowMoney;
    expense: CashFlowMoney;
    closing: CashFlowMoney;
  };
  /** П.8 — приход за период: доли Terminal / Naqd */
  payment_type_breakdown: {
    period_income: CashFlowMoney;
    terminal_share_pct: number | null;
    cash_share_pct: number | null;
  };
  /** So‘nggi yopilgan smena (cash_desk_shifts.closing_float) — `cashbox_balance` jadvali yo‘qligi uchun ma’lumot */
  opening_hint: {
    last_closed_shift: {
      closed_at: string;
      closing_float: string | null;
      opening_float: string | null;
    } | null;
  };
  /** Spetsifikatsiya §12–13 ↔ amaldagi jadvallar */
  data_model_mapping: Array<{ concept: string; source: string; comment?: string }>;
  ledger: { formula: string; closing_equals: string };
  table: { rows: CashFlowTableRow[] };
  /** Hisobot cheklovlari / tushuntirish */
  notes: string[];
};

export type Split = { terminal: Prisma.Decimal; cash: Prisma.Decimal };

export const ZERO: Split = { terminal: new Prisma.Decimal(0), cash: new Prisma.Decimal(0) };

export type AggRow = { entry_kind: string; payment_type: string; order_id: number | null; s: Prisma.Decimal };
