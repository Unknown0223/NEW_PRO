"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useTenant } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { fmtDateTime, money, PAYOUT_KIND, payrollApi, STATUS_TONE, ymLabel, ymQuery, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { StatusBadge, TonePill } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction,
  PayrollPagination,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Payout = {
  id: number;
  kind: string;
  fio: string;
  year: number;
  month: number;
  amount: number;
  currency: string;
  amount_uzs: number;
  rate: number;
  cash_desk_name: string | null;
  payment_method_ref: string | null;
  paid_at: string;
  paid_by: string | null;
  status: string;
  reverse_reason: string | null;
  expense_id: number | null;
};

const REVERSED = { label: "Сторно", ...STATUS_TONE.rose };

/** Payout history table body (toolbar + table + footer) for use inside a table card. */
export function PayrollPayoutsHistory({ ym, kind, onNotice }: { ym: Ym; kind: string; onNotice: { ok: (t: string) => void; fail: (e: unknown) => void } }) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canReverse = perms.isAdmin;
  const [search, setSearch] = useState("");
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.payouts", defaultColumnOrder: ["date"], defaultPageSize: 20 });

  const q = useQuery({
    queryKey: ["payroll-payouts", tenant, ym.year, ym.month, kind],
    enabled: Boolean(tenant),
    queryFn: () => api.get<Payout[]>(`/payouts?${ymQuery(ym)}${kind ? `&kind=${kind}` : ""}&limit=1000`)
  });
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !s || `${r.fio} ${r.cash_desk_name ?? ""} ${r.paid_by ?? ""}`.toLowerCase().includes(s));
  }, [q.data, search]);
  const paged = usePagedRows(rows, prefs.pageSize, `${ym.year}-${ym.month}|${kind}|${search}`);
  const total = rows.filter((r) => r.status !== "reversed").reduce((s, r) => s + r.amount_uzs, 0);

  const reverse = useMutation({
    mutationFn: (p: { id: number; reason: string }) => api.send("POST", `/payouts/${p.id}/reverse`, { reason: p.reason }),
    onSuccess: () => {
      onNotice.ok("Выплата сторнирована: касса восстановлена, расход аннулирован, аванс вернулся в очередь");
      void qc.invalidateQueries({ queryKey: ["payroll-payouts", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-cashier-queue", tenant] });
    },
    onError: onNotice.fail
  });

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        `vyplaty-${ymToInput(ym)}.xlsx`,
        ["Дата", "Сотрудник", "Месяц", "Тип", "Сумма", "Валюта", "Сумма (UZS)", "Касса", "Способ", "Кассир", "Расход", "Статус"],
        rows.map((r) => [
          fmtDateTime(r.paid_at),
          r.fio,
          ymLabel(r),
          PAYOUT_KIND[r.kind]?.label ?? r.kind,
          r.amount,
          r.currency,
          r.amount_uzs,
          r.cash_desk_name ?? "",
          r.payment_method_ref ?? "наличные",
          r.paid_by ?? "",
          r.expense_id ?? "",
          r.status === "reversed" ? `Сторно: ${r.reverse_reason ?? ""}` : "Выплачено"
        ]),
        ymLabel(ym)
      );
    } catch (e) {
      onNotice.fail(e);
    }
  };

  return (
    <>
      <PayrollTableToolbar
        pageSize={prefs.pageSize}
        onPageSize={prefs.setPageSize}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Поиск: сотрудник, касса, кассир"
        onRefresh={() => void q.refetch()}
        refreshing={q.isFetching}
        onExport={() => void exportXlsx()}
      >
        <span className="text-sm text-muted-foreground">
          {ymLabel(ym)}: <b className="text-foreground">{money(total)}</b>
        </span>
      </PayrollTableToolbar>
      <div className="overflow-x-auto">
        <table className={PAYROLL_TABLE}>
          <thead className={PAYROLL_THEAD}>
            <tr>
              <th className={TH}>Дата</th>
              <th className={TH}>Сотрудник</th>
              <th className={TH}>Тип</th>
              <th className={cn(TH, "text-right")}>Сумма</th>
              <th className={TH}>Касса / способ</th>
              <th className={TH}>Кассир</th>
              <th className={TH}>Расход</th>
              <th className={cn(TH, "w-20 text-center")}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={8} loading={q.isLoading} /> : null}
            {paged.pageRows.map((r) => {
              const reversed = r.status === "reversed";
              return (
                <tr key={r.id} className={cn(PAYROLL_TR, reversed && "opacity-60")}>
                  <td className={cn(TD, "text-xs")}>{fmtDateTime(r.paid_at)}</td>
                  <td className={TD}>
                    <div className="font-medium text-foreground">{r.fio}</div>
                    <div className="text-[11px] text-muted-foreground">{ymLabel(r)}</div>
                  </td>
                  <td className={TD}>
                    <StatusBadge map={PAYOUT_KIND} status={r.kind} />
                  </td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums", reversed && "line-through")}>
                    {money(r.amount, 2)} {r.currency}
                    {r.rate !== 1 ? <div className="text-[11px] font-normal text-muted-foreground">= {money(r.amount_uzs)} · курс {r.rate}</div> : null}
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {r.cash_desk_name ?? "—"}
                    <div className="text-muted-foreground">{r.payment_method_ref ?? "наличные"}</div>
                  </td>
                  <td className={cn(TD, "text-xs")}>{r.paid_by ?? "—"}</td>
                  <td className={cn(TD, "text-xs")}>
                    {r.expense_id ? `#${r.expense_id}` : "—"}
                    {reversed ? (
                      <div className="mt-1">
                        <TonePill cls={REVERSED.cls} dot={REVERSED.dot}>{REVERSED.label}</TonePill>
                        {r.reverse_reason ? <div className="mt-0.5 text-red-700">{r.reverse_reason}</div> : null}
                      </div>
                    ) : null}
                  </td>
                  <td className={cn(TD, "text-center")}>
                    {canReverse && !reversed ? (
                      <PayrollIconAction
                        label="Сторно выплаты"
                        tone="danger"
                        onClick={() => {
                          const reason = window.prompt(`Сторно выплаты ${r.fio} на ${money(r.amount)}. Причина:`);
                          if (reason?.trim()) reverse.mutate({ id: r.id, reason: reason.trim() });
                        }}
                      >
                        <Undo2 className="size-3.5" />
                      </PayrollIconAction>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
    </>
  );
}
