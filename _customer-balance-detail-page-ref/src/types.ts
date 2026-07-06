// ===== DATABASE MODELS =====

export type PaymentMethod = 'cash' | 'terminal' | 'transfer' | 'mixed';

export type TransactionType =
  | 'order'        // Заказ
  | 'invoice'      // Накладная
  | 'payment'      // Оплата
  | 'return'       // Возврат
  | 'correction'   // Корректировка
  | 'debt_adjustment'; // Корректировка долга

export interface Customer {
  id: number;
  name: string;
  phone: string;
  territory: string;
}

export interface Agent {
  id: number;
  name: string;
}

export interface Expeditor {
  id: number;
  name: string;
}

export interface Cashbox {
  id: number;
  name: string;
}

export interface BalanceCard {
  id: string;
  title: string;
  amount: number;        // So'm
  oldDebtIncome: number; // Эски карздан кирим
  cash: number;          // Naqd
  transfer: number;      // Pereches
  terminal: number;      // Terminal
}

export interface AuditEntry {
  at: string;
  user: string;
  action: string;
}

export interface DebtTransaction {
  id: number;
  docNumber: number;
  createdAt: string;        // ISO
  type: TransactionType;
  typeLabel: string;        // Заказ / Оплата ...
  operationName: string;    // Блокировка заказа / Приём оплаты ...
  orderType: string;        // Заказ / Оплата ...
  consignment: boolean;
  debt: number;             // negative
  payment: number;          // positive
  balanceAfter: number;
  paymentMethod: PaymentMethod | null;
  agent: string;
  expeditor: string;
  cashbox: string;
  comment: string;          // Комментарий
  txComment: string;        // Комментарий к транзакциям
  createdBy: string;
  isSystem: boolean;
  audit: AuditEntry[];
}

// ===== FILTER / QUERY STATE =====

export interface Filters {
  dateFrom: string;
  dateTo: string;
  types: TransactionType[];
  paymentMethods: PaymentMethod[];
  agents: string[];
  expeditors: string[];
  consignment: '' | 'yes' | 'no';
  cashbox: string;
  comment: string;
  createdBy: string;
  debtMin: string;
  debtMax: string;
  paymentMin: string;
  paymentMax: string;
}

export const emptyFilters: Filters = {
  dateFrom: '',
  dateTo: '',
  types: [],
  paymentMethods: [],
  agents: [],
  expeditors: [],
  consignment: '',
  cashbox: '',
  comment: '',
  createdBy: '',
  debtMin: '',
  debtMax: '',
  paymentMin: '',
  paymentMax: '',
};

export type SortField = 'createdAt' | 'debt' | 'payment' | 'docNumber';
export type SortDir = 'asc' | 'desc';

export type ViewTab = 'overall' | 'detailed';

export type LoadState = 'idle' | 'loading' | 'refreshing' | 'searching' | 'error' | 'empty' | 'success';

// ===== PERMISSIONS =====

export interface Permissions {
  viewBalance: boolean;
  viewDebt: boolean;
  viewPayments: boolean;
  exportExcel: boolean;
  viewAgentBreakdown: boolean;
  viewFinancialAnalytics: boolean;
}

export const currentPermissions: Permissions = {
  viewBalance: true,
  viewDebt: true,
  viewPayments: true,
  exportExcel: true,
  viewAgentBreakdown: true,
  viewFinancialAnalytics: true,
};
