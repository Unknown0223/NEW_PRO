import type { ClientLedgerRow } from "@/lib/client-balance-ledger-types";
import type { KpiPaymentSubLine } from "@/lib/ledger-kpi-payment-triple";

export type BalanceDetailViewTab = "overall" | "detailed";

export type BalanceDetailSortField = "createdAt" | "debt" | "payment" | "docNumber";
export type BalanceDetailSortDir = "asc" | "desc";

export type BalanceDetailCustomer = {
  id: number;
  name: string;
  phone: string;
  territory: string;
};

export type BalanceDetailCard = {
  id: string;
  title: string;
  amount: number;
  oldDebtIncome: number;
  cash: number;
  transfer: number;
  terminal: number;
  /** API spravochnik bo‘yicha haqiqiy qatorlar (Naqd / Perechis / Terminal yoki xom label) */
  paymentSubLines: KpiPaymentSubLine[];
  agentId: number | null;
};

export type BalanceDetailFilters = {
  dateFrom: string;
  dateTo: string;
  types: string[];
  paymentMethods: string[];
  agents: string[];
  expeditors: string[];
  consignment: "" | "yes" | "no";
  cashbox: string;
  comment: string;
  createdBy: string;
  debtMin: string;
  debtMax: string;
  paymentMin: string;
  paymentMax: string;
  rowKind: "all" | "debt" | "payment";
};

export const emptyBalanceDetailFilters: BalanceDetailFilters = {
  dateFrom: "",
  dateTo: "",
  types: [],
  paymentMethods: [],
  agents: [],
  expeditors: [],
  consignment: "",
  cashbox: "",
  comment: "",
  createdBy: "",
  debtMin: "",
  debtMax: "",
  paymentMin: "",
  paymentMax: "",
  rowKind: "all"
};

/** Строка таблицы (шаблон + ссылки на заказ/оплату). */
export type BalanceDetailRow = {
  key: string;
  raw: ClientLedgerRow;
  createdAt: string;
  typeLabel: string;
  docNumber: string;
  operationName: string;
  orderType: string;
  consignment: boolean;
  debt: number;
  payment: number;
  balanceAfter: number | null;
  paymentMethod: string;
  agent: string;
  expeditor: string;
  cashbox: string;
  comment: string;
  txComment: string;
  createdBy: string;
  isSystem: boolean;
};

export type BalanceDetailColumnDef = {
  key: string;
  label: string;
  visible: boolean;
  sortField?: BalanceDetailSortField;
  align?: "right";
  width?: string;
  tabs: BalanceDetailViewTab[];
};
