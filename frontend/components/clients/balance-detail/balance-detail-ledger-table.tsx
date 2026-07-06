"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { BALANCE_DETAIL_COLUMNS } from "@/lib/client-balance-detail/columns";
import { fmtDateTime, fmtMoney } from "@/lib/client-balance-detail/format";
import type {
  BalanceDetailColumnDef,
  BalanceDetailRow,
  BalanceDetailSortDir,
  BalanceDetailSortField,
  BalanceDetailViewTab
} from "@/lib/client-balance-detail/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: BalanceDetailRow[];
  tab: BalanceDetailViewTab;
  columns: BalanceDetailColumnDef[];
  sortField: BalanceDetailSortField;
  sortDir: BalanceDetailSortDir;
  onSort: (field: BalanceDetailSortField) => void;
  onRowClick: (row: BalanceDetailRow) => void;
  loading?: boolean;
  canEditPayment?: boolean;
  onEditPayment?: (paymentId: number) => void;
};

function SortIcon({
  field,
  sortField,
  sortDir
}: {
  field: BalanceDetailSortField;
  sortField: BalanceDetailSortField;
  sortDir: BalanceDetailSortDir;
}) {
  if (field !== sortField) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3 text-[#1aa096]" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3 text-[#1aa096]" />
  );
}

function consignmentLabel(v: boolean) {
  return v ? "Да" : "Нет";
}

export function BalanceDetailLedgerTable({
  rows,
  tab,
  columns,
  sortField,
  sortDir,
  onSort,
  onRowClick,
  loading,
  canEditPayment,
  onEditPayment
}: Props) {
  const visibleCols = columns.filter((c) => c.visible && c.tabs.includes(tab));
  const colSpan = visibleCols.length + (canEditPayment ? 1 : 0);

  function renderCell(row: BalanceDetailRow, col: BalanceDetailColumnDef) {
    const r = row.raw;
    switch (col.key) {
      case "date":
        return <span className="whitespace-nowrap">{fmtDateTime(row.createdAt)}</span>;
      case "type":
        if (r.row_kind === "order" && r.order_id != null) {
          return (
            <Link
              href={`/orders/${r.order_id}`}
              className="font-medium text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.typeLabel}
            </Link>
          );
        }
        if (r.row_kind === "payment" && r.payment_id != null) {
          return (
            <Link
              href={`/payments/${r.payment_id}`}
              className={cn(
                "font-medium hover:underline",
                r.entry_kind === "client_expense" ? "text-amber-600" : "text-[#1aa096]"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {row.typeLabel}
            </Link>
          );
        }
        return row.typeLabel;
      case "opName":
        return <span className="font-mono text-[11px]">{row.operationName}</span>;
      case "orderType":
        return row.orderType;
      case "consignment_d":
      case "consignment":
        return consignmentLabel(row.consignment);
      case "debt":
        return row.debt !== 0 ? (
          <span className={tab === "overall" ? "font-medium text-red-600" : ""}>{fmtMoney(Math.abs(row.debt))}</span>
        ) : (
          "—"
        );
      case "payment":
        return row.payment !== 0 ? (
          <span className={tab === "overall" ? "font-medium text-[#1aa096]" : ""}>{fmtMoney(row.payment)}</span>
        ) : (
          "—"
        );
      case "balanceAfter":
        return row.balanceAfter != null ? (
          <span className={row.balanceAfter < 0 ? "text-red-600" : "text-[#1aa096]"}>{fmtMoney(row.balanceAfter)}</span>
        ) : (
          "—"
        );
      case "method":
        return row.paymentMethod || "—";
      case "agent":
        return row.agent || "—";
      case "expeditor":
        return row.expeditor || "—";
      case "cashbox":
        return row.cashbox || "—";
      case "comment":
        return <span className="max-w-[240px] truncate text-[#666]">{row.comment || "—"}</span>;
      case "txComment":
        return <span className="max-w-[200px] truncate text-[#666]">{row.txComment || "—"}</span>;
      case "createdBy":
        return row.createdBy || "—";
      default:
        return "—";
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-[#f3f4f6]">
          <tr className="border-b border-[#e5e7eb]">
            {visibleCols.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "whitespace-nowrap px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#666]",
                  col.align === "right" && "text-right",
                  col.width,
                  col.sortField && "cursor-pointer select-none hover:bg-[#e9ecef]"
                )}
                onClick={() => col.sortField && onSort(col.sortField)}
              >
                {col.label}
                {col.sortField ? <SortIcon field={col.sortField} sortField={sortField} sortDir={sortDir} /> : null}
              </th>
            ))}
            {canEditPayment ? <th className="w-8 px-1 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-[#999]">
                Загрузка…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-[#999]">
                Нет данных
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.key}
                onClick={() => onRowClick(row)}
                className={cn(
                  "cursor-pointer border-b border-[#f0f0f0] transition-colors hover:bg-[#f0faf9]",
                  i % 2 === 1 && "bg-[#fafbfc]"
                )}
              >
                {visibleCols.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-2 py-1.5 text-[#333]", col.align === "right" && "text-right tabular-nums")}
                  >
                    {renderCell(row, col)}
                  </td>
                ))}
                {canEditPayment ? (
                  <td className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
                    {row.raw.row_kind === "payment" && row.raw.payment_id != null ? (
                      <button
                        type="button"
                        className="rounded p-0.5 text-[#999] hover:bg-[#eee] hover:text-[#333]"
                        title="Редактировать"
                        onClick={() => onEditPayment?.(row.raw.payment_id!)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { BALANCE_DETAIL_COLUMNS };
