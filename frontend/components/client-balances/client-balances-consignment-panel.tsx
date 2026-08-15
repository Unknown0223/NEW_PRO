"use client";

import { overdueBadgeClass } from "@/components/client-balances/client-balances-template-ui";
import type { ClientBalancesFilterForm } from "@/components/client-balances/client-balances-filters-panel";
import {
  appendPositiveIntListParam,
  appendStringListParam,
  splitMultiFilterValues
} from "@/lib/client-filter-select-value";
import { clientBalancesColLabel } from "@/lib/client-balances-table-columns";
import type { ConsignmentBalanceRow } from "@/lib/consignment-balances-types";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { formatClientDisplayId } from "@shared/client-display-id";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

function appendBranchListParam(params: URLSearchParams, raw: string): void {
  const items = splitMultiFilterValues(raw);
  if (items.length === 0) return;
  if (items.length === 1) params.set("agent_branch", items[0]!);
  else params.set("branch_ids", items.join(","));
}

function appendExclusiveEnumListParam(
  params: URLSearchParams,
  singleKey: string,
  multiKey: string,
  raw: string,
  allValues: string[]
): void {
  const items = splitMultiFilterValues(raw).filter((x) => allValues.includes(x));
  if (items.length === 0) return;
  if (items.length >= allValues.length) return;
  if (items.length === 1) params.set(singleKey, items[0]!);
  else params.set(multiKey, items.join(","));
}

/** Main filter form → `/client-balances/consignment` query. */
export function buildConsignmentBalancesQuery(
  form: ClientBalancesFilterForm,
  page: number,
  limit: number,
  search: string,
  largeExport?: boolean
): string {
  const p = new URLSearchParams();
  p.set("view", "clients");
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (largeExport) p.set("large_export", "1");
  if (search.trim()) p.set("search", search.trim());
  appendPositiveIntListParam(p, "agent_id", "agent_ids", form.agent_id);
  appendPositiveIntListParam(p, "expeditor_user_id", "expeditor_user_ids", form.expeditor_user_id);
  appendPositiveIntListParam(p, "supervisor_user_id", "supervisor_user_ids", form.supervisor_user_id);
  appendStringListParam(p, "trade_direction", form.trade_direction);
  appendStringListParam(p, "category", form.category);
  appendExclusiveEnumListParam(p, "status", "statuses", form.status, ["active", "inactive"]);
  appendStringListParam(p, "territory_zone", form.territory_zone);
  appendStringListParam(p, "territory_region", form.territory_region);
  appendStringListParam(p, "territory_city", form.territory_city);
  if (form.order_date.trim()) {
    p.set("order_date_from", form.order_date.trim());
    p.set("order_date_to", form.order_date.trim());
  }
  if (form.license_from.trim()) p.set("consignment_due_from", form.license_from.trim());
  if (form.license_to.trim()) p.set("consignment_due_to", form.license_to.trim());
  appendBranchListParam(p, form.agent_branch);
  return p.toString();
}

function parseAmount(s: string): number {
  const t = String(s)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(/\u2212/g, "-")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}

function clientDisplayId(r: ConsignmentBalanceRow): string {
  return formatClientDisplayId(r.client_id, r.client_code);
}

function normPayColumnLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
}

function amountForPaymentLabel(
  amounts: ConsignmentBalanceRow["payment_amounts"] | undefined,
  label: string,
  idx: number
): string {
  if (!amounts?.length) return "0";
  const exact = amounts.find((a) => a.label === label);
  if (exact) return exact.amount;
  const want = normPayColumnLabel(label);
  const fuzzy = amounts.find((a) => normPayColumnLabel(a.label) === want);
  if (fuzzy) return fuzzy.amount;
  return amounts[idx]?.amount ?? "0";
}

function MoneyCell({ value }: { value: string }) {
  const n = parseAmount(value);
  const debt = n < 0;
  const credit = n > 0;
  return (
    <span
      className={cn(
        "block whitespace-nowrap text-right tabular-nums",
        debt && "font-bold text-[#e02b2b]",
        credit && "font-bold text-[#0c8f5a]",
        !debt && !credit && "font-medium text-slate-500"
      )}
    >
      {formatNumberGrouped(value, { maxFractionDigits: 2 })}
    </span>
  );
}

function excelCell(r: ConsignmentBalanceRow, colId: string): string | number {
  switch (colId) {
    case "client_id":
      return clientDisplayId(r);
    case "name":
      return r.client_name;
    case "agent_name":
      return r.agent_name ?? "";
    case "agent_code":
      return r.agent_code ?? "";
    case "supervisor_name":
      return r.supervisor_name ?? "";
    case "legal_name":
      return r.company_name ?? "";
    case "trade_direction":
      return r.trade_direction ?? "";
    case "inn":
      return r.inn ?? "";
    case "phone":
      return r.phone ?? "";
    case "due_date":
      return r.due_date ? formatDateOnly(r.due_date) : "";
    case "overdue_days":
      return r.overdue_days ?? "";
    case "total_debt":
      return r.total_debt;
    case "total_paid":
      return r.total_paid;
    case "balance":
      return r.balance;
    default:
      return "";
  }
}

export async function downloadConsignmentBalancesExcel(
  rows: ConsignmentBalanceRow[],
  paymentColumnLabels: string[],
  visibleColumnOrder: string[]
) {
  const baseHeaders = visibleColumnOrder.map((id) => clientBalancesColLabel(id, "consignment"));
  const headers = [...baseHeaders, ...paymentColumnLabels];
  const dataRows = rows.map((r) => [
    ...visibleColumnOrder.map((id) => excelCell(r, id)),
    ...paymentColumnLabels.map((lab, idx) => amountForPaymentLabel(r.payment_amounts, lab, idx))
  ]);
  await downloadXlsxSheet(
    `balansy-konsignatsiya-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "Консигнация",
    headers,
    dataRows
  );
}

export function ConsignmentBalancesTable({
  loading,
  rows,
  paymentColumnLabels,
  visibleColumnOrder,
  statusFilter
}: {
  loading: boolean;
  rows: ConsignmentBalanceRow[];
  paymentColumnLabels: string[];
  visibleColumnOrder: string[];
  statusFilter: string;
}) {
  const nPay = paymentColumnLabels.length;
  const colCount = visibleColumnOrder.length + nPay;
  const showInactiveBadge = (() => {
    const vals = splitMultiFilterValues(statusFilter);
    if (vals.length === 0) return true;
    return vals.includes("active") && vals.includes("inactive");
  })();

  const renderCell = (r: ConsignmentBalanceRow, colId: string) => {
    switch (colId) {
      case "client_id":
        return (
          <td
            key={colId}
            className="sticky left-0 z-[1] whitespace-nowrap bg-card px-3 py-3.5 font-mono text-xs shadow-[1px_0_0_0_hsl(var(--border))]"
          >
            <Link
              className="font-medium text-[#0e9180] underline-offset-2 hover:underline"
              href={`/clients/${r.client_id}/balances`}
            >
              {clientDisplayId(r)}
            </Link>
          </td>
        );
      case "name":
        return (
          <td key={colId} className="max-w-[16rem] whitespace-nowrap px-3 py-3.5">
            <div className="flex max-w-full items-center gap-1.5">
              <Link
                className="min-w-0 truncate font-medium text-slate-800 underline-offset-2 hover:underline"
                href={`/clients/${r.client_id}/balances`}
                title={r.client_name}
              >
                {r.client_name}
              </Link>
              {showInactiveBadge && r.is_active === false && parseAmount(r.balance) !== 0 ? (
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600"
                  title="Неактивный клиент с ненулевым балансом"
                >
                  <AlertCircle className="h-3 w-3" />
                </span>
              ) : null}
            </div>
          </td>
        );
      case "agent_name":
        return (
          <td
            key={colId}
            className="max-w-[14rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-700"
            title={r.agent_name ?? undefined}
          >
            {r.agent_name ?? "—"}
          </td>
        );
      case "agent_code":
        return (
          <td
            key={colId}
            className="max-w-[8rem] truncate whitespace-nowrap px-3 py-3.5 font-mono text-xs text-slate-600"
            title={r.agent_code ?? undefined}
          >
            {r.agent_code ?? "—"}
          </td>
        );
      case "supervisor_name":
        return (
          <td
            key={colId}
            className="max-w-[8rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-600"
            title={r.supervisor_name ?? undefined}
          >
            {r.supervisor_name ?? "—"}
          </td>
        );
      case "legal_name":
        return (
          <td
            key={colId}
            className="max-w-[10rem] truncate whitespace-nowrap px-3 py-3.5 text-xs text-slate-700"
            title={r.company_name ?? undefined}
          >
            {r.company_name ?? "—"}
          </td>
        );
      case "trade_direction":
        return (
          <td key={colId} className="max-w-[8rem] whitespace-nowrap px-3 py-3.5 text-xs">
            {r.trade_direction ? (
              <span
                className="inline-block max-w-full truncate rounded-md border border-border px-2 py-1 text-[11.5px] font-medium text-slate-600"
                title={r.trade_direction}
              >
                {r.trade_direction}
              </span>
            ) : (
              "—"
            )}
          </td>
        );
      case "inn":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 font-mono text-xs text-slate-500">
            {r.inn ?? "—"}
          </td>
        );
      case "phone":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {r.phone ?? "—"}
          </td>
        );
      case "due_date":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">
            {formatDateOnly(r.due_date)}
          </td>
        );
      case "overdue_days":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
            {r.overdue_days != null ? (
              <span
                className={cn(
                  "inline-block rounded-md px-2 py-1 text-[12px] font-semibold ring-1 ring-inset",
                  overdueBadgeClass(r.overdue_days)
                )}
              >
                {r.overdue_days}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        );
      case "total_debt":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5">
            <MoneyCell value={r.total_debt} />
          </td>
        );
      case "total_paid":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5">
            <MoneyCell value={r.total_paid} />
          </td>
        );
      case "balance":
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5">
            <MoneyCell value={r.balance} />
          </td>
        );
      default:
        return (
          <td key={colId} className="whitespace-nowrap px-3 py-3.5 text-slate-300">
            —
          </td>
        );
    }
  };

  return (
    <div className="space-y-2">
      <p className="px-4 text-xs text-slate-500">
        Заказы с признаком консигнации или консигнационным агентом (только доставленные). В списке —
        должники. Долг = сумма заказа − оплаты по заказу.
      </p>
      <div className="scrollbar-none overflow-x-auto">
        <table
          className="w-full min-w-0 border-collapse text-[13px]"
          style={{ minWidth: Math.max(1100, 900 + visibleColumnOrder.length * 72 + nPay * 112) }}
        >
          <thead>
            <tr className="border-y border-border text-left text-[12.5px] font-medium text-slate-500">
              {visibleColumnOrder.map((colId) => {
                const right =
                  colId === "overdue_days" ||
                  colId === "total_debt" ||
                  colId === "total_paid" ||
                  colId === "balance";
                return (
                  <th
                    key={colId}
                    className={cn(
                      "whitespace-nowrap px-3 py-3.5",
                      colId === "client_id" && "sticky left-0 z-10 bg-card",
                      right && "text-right"
                    )}
                  >
                    {clientBalancesColLabel(colId, "consignment")}
                  </th>
                );
              })}
              {paymentColumnLabels.map((lab) => (
                <th
                  key={lab}
                  className="max-w-[10rem] truncate whitespace-nowrap px-3 py-3.5 text-right text-xs"
                  title={lab}
                >
                  {lab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={Math.max(1, colCount)} className="px-4 py-16 text-center text-slate-400">
                  Загрузка…
                </td>
              </tr>
            ) : visibleColumnOrder.length === 0 && nPay === 0 ? (
              <tr>
                <td colSpan={1} className="px-4 py-16 text-center text-slate-400">
                  Нет видимых столбцов
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, colCount)} className="px-4 py-16 text-center text-slate-400">
                  Нет долга по консигнации с выбранными фильтрами
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.client_id} className="border-b border-slate-50 transition-colors hover:bg-muted/60">
                  {visibleColumnOrder.map((colId) => renderCell(r, colId))}
                  {paymentColumnLabels.map((lab, idx) => (
                    <td key={`${r.client_id}-${lab}`} className="whitespace-nowrap px-3 py-3.5">
                      <MoneyCell value={amountForPaymentLabel(r.payment_amounts, lab, idx)} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
