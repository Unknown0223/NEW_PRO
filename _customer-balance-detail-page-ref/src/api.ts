// ===== API LAYER =====
// Simulates the backend endpoints:
//   GET /customer-balance
//   GET /customer-balance/summary
//   GET /customer-balance/details
//   GET /customer-balance/export
//   GET /customer-balance/agents

import { allTransactions, agents, balanceCards, customer } from './data';
import type { DebtTransaction, Filters, SortDir, SortField } from './types';

const LATENCY = 450;

function delay<T>(v: T, ms = LATENCY): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export interface QueryParams {
  page: number;
  perPage: number;
  search: string;
  sortField: SortField;
  sortDir: SortDir;
  filters: Filters;
  showSystem: boolean;
}

export interface QueryResult {
  rows: DebtTransaction[];
  total: number;
  totalDebt: number;
  totalPayment: number;
  netBalance: number;
}

function applyQuery(params: QueryParams): DebtTransaction[] {
  const { search, filters, showSystem } = params;
  const q = search.trim().toLowerCase();

  return allTransactions.filter((t) => {
    if (!showSystem && t.isSystem) return false;

    if (q) {
      const hay = [
        String(t.docNumber), t.typeLabel, t.operationName, t.agent, t.expeditor,
        t.cashbox, t.comment, t.txComment, t.createdBy, String(t.debt), String(t.payment),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (filters.dateFrom && t.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && t.createdAt.slice(0, 10) > filters.dateTo) return false;
    if (filters.types.length && !filters.types.includes(t.type)) return false;
    if (filters.paymentMethods.length && (!t.paymentMethod || !filters.paymentMethods.includes(t.paymentMethod))) return false;
    if (filters.agents.length && !filters.agents.includes(t.agent)) return false;
    if (filters.expeditors.length && !filters.expeditors.includes(t.expeditor)) return false;
    if (filters.consignment === 'yes' && !t.consignment) return false;
    if (filters.consignment === 'no' && t.consignment) return false;
    if (filters.cashbox && !t.cashbox.toLowerCase().includes(filters.cashbox.toLowerCase())) return false;
    if (filters.comment && !(t.comment + ' ' + t.txComment).toLowerCase().includes(filters.comment.toLowerCase())) return false;
    if (filters.createdBy && !t.createdBy.toLowerCase().includes(filters.createdBy.toLowerCase())) return false;
    if (filters.debtMin !== '' && Math.abs(t.debt) < Number(filters.debtMin)) return false;
    if (filters.debtMax !== '' && Math.abs(t.debt) > Number(filters.debtMax)) return false;
    if (filters.paymentMin !== '' && t.payment < Number(filters.paymentMin)) return false;
    if (filters.paymentMax !== '' && t.payment > Number(filters.paymentMax)) return false;
    return true;
  });
}

function sortRows(rows: DebtTransaction[], field: SortField, dir: SortDir): DebtTransaction[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (field === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt) || a.id - b.id;
    else if (field === 'debt') cmp = a.debt - b.debt;
    else if (field === 'payment') cmp = a.payment - b.payment;
    else cmp = a.docNumber - b.docNumber;
    return cmp * m;
  });
}

// GET /customer-balance/details
export async function fetchDetails(params: QueryParams): Promise<QueryResult> {
  const filtered = sortRows(applyQuery(params), params.sortField, params.sortDir);
  const start = (params.page - 1) * params.perPage;
  const rows = filtered.slice(start, start + params.perPage);
  const totalDebt = filtered.reduce((s, t) => s + t.debt, 0);
  const totalPayment = filtered.reduce((s, t) => s + t.payment, 0);
  return delay({
    rows,
    total: filtered.length,
    totalDebt,
    totalPayment,
    netBalance: totalDebt + totalPayment,
  });
}

// GET /customer-balance/export
export async function fetchExportRows(params: QueryParams, mode: 'page' | 'filtered' | 'full'): Promise<DebtTransaction[]> {
  if (mode === 'full') return delay(sortRows(allTransactions, params.sortField, params.sortDir), 800);
  const filtered = sortRows(applyQuery(params), params.sortField, params.sortDir);
  if (mode === 'filtered') return delay(filtered, 800);
  const start = (params.page - 1) * params.perPage;
  return delay(filtered.slice(start, start + params.perPage), 600);
}

// GET /customer-balance/summary
export async function fetchSummary() {
  return delay({ customer, cards: balanceCards });
}

// GET /customer-balance/agents
export async function fetchAgents() {
  return delay(agents);
}
