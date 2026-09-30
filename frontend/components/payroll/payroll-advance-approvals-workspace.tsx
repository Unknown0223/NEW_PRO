"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect, filterPanelSelectClassName } from "@/components/ui/filter-select";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, fmtDateTime, inputToYm, money, payrollApi, roleLabel, ymLabel } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { StatusBadge, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import {
  PAYROLL_FILTER_CONTROL,
  PayrollCardTab,
  PayrollEmptyRow,
  PayrollFilterField,
  PayrollFiltersSection,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Row = {
  id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  year: number;
  month: number;
  amount: number;
  status: string;
  comment: string | null;
  created_at: string;
  created_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  reject_reason: string | null;
  payout_id: number | null;
};
type Data = { rows: Row[]; totals: { count: number; amount: number }; filters: { branches: string[]; senders: Array<{ id: number; fio: string }> } };

const TABS = [
  { key: "sent", label: "На утверждении" },
  { key: "approved", label: "Утверждены (ждут выдачи)" },
  { key: "paid", label: "Выданы" },
  { key: "rejected", label: "Отклонены" }
];
const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5 align-top";

export function PayrollAdvanceApprovalsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canApprove = perms.isAdmin || perms.has("finance.avans.approve");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [tab, setTab] = useState("sent");
  const [month, setMonth] = useState("");
  const [branch, setBranch] = useState("");
  const [sender, setSender] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advance-approvals", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const params = useMemo(() => {
    const p = new URLSearchParams({ status: tab });
    const ym = inputToYm(month);
    if (ym) {
      p.set("year", String(ym.year));
      p.set("month", String(ym.month));
    }
    if (branch) p.set("branch", branch);
    if (sender) p.set("sent_by", sender);
    if (dateFrom) p.set("date_from", `${dateFrom}T00:00:00`);
    if (dateTo) p.set("date_to", `${dateTo}T23:59:59`);
    return p.toString();
  }, [tab, month, branch, sender, dateFrom, dateTo]);

  const dataQ = useQuery({
    queryKey: ["payroll-advance-approvals", tenant, params],
    enabled: Boolean(tenant),
    refetchInterval: 30_000,
    queryFn: () => api.get<Data>(`/advance-approvals?${params}`)
  });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (dataQ.data?.rows ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s));
  }, [dataQ.data, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${q}`);
  const selected = rows.filter((r) => sel.ids.has(r.id));
  const selSum = selected.reduce((s, r) => s + r.amount, 0);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["payroll-advance-approvals", tenant] });

  const act = useMutation({
    mutationFn: (p: { action: "approve" | "reject" | "cancel"; ids: number[]; reason?: string }) =>
      api.send<Record<string, unknown>>("POST", `/advance-approvals/${p.action}`, { ids: p.ids, reason: p.reason }),
    onSuccess: (r, p) => {
      const key = p.action === "approve" ? "approved" : p.action === "reject" ? "rejected" : "cancelled";
      const skipped = Array.isArray(r?.skipped) ? (r.skipped as Array<{ reason?: string }>) : [];
      const label = p.action === "approve" ? "Утверждено" : p.action === "reject" ? "Отклонено" : "Отменено";
      notice.ok(`${label}: ${Number(r?.[key] ?? 0)}${skipped.length ? `\nПропущено ${skipped.length}: ${[...new Set(skipped.map((s) => s.reason))].join(", ")}` : ""}`);
      sel.clear();
      refresh();
    },
    onError: notice.fail
  });

  const run = async (action: "approve" | "reject" | "cancel", ids: number[], sum: number) => {
    if (!ids.length) return;
    if (action === "reject") {
      const reason = window.prompt("Причина отклонения");
      if (!reason?.trim()) return;
      act.mutate({ action, ids, reason: reason.trim() });
      return;
    }
    const ok = await confirm({
      title: action === "approve" ? "Утвердить авансы" : "Отменить авансы",
      message: `${ids.length} шт. на сумму ${money(sum)}`,
      detail: action === "approve" ? "После утверждения авансы попадут в очередь кассира филиала." : undefined,
      confirmLabel: action === "approve" ? "Утвердить" : "Отменить авансы",
      cancelLabel: "Назад",
      destructive: action !== "approve"
    });
    if (ok) act.mutate({ action, ids });
  };

  const pageAllOn = paged.pageRows.length > 0 && paged.pageRows.every((r) => sel.ids.has(r.id));

  return (
    <PageShell className="payroll-template">
      <PageHeader title="Утверждение авансов" description="Авансы, отправленные руководителями. Утверждённые попадают в очередь кассира филиала по времени утверждения." />
      <PayrollFiltersSection>
        <PayrollFilterField label="Месяц">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={cn(PAYROLL_FILTER_CONTROL, "w-44")} title="Пусто — все месяцы" />
        </PayrollFilterField>
        <PayrollFilterField label="Филиал">
          <FilterSelect emptyLabel="Все филиалы" className={filterPanelSelectClassName} value={branch} onChange={(e) => setBranch(e.target.value)}>
            {(dataQ.data?.filters.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
          </FilterSelect>
        </PayrollFilterField>
        <PayrollFilterField label="Отправитель">
          <FilterSelect emptyLabel="Все отправители" className={filterPanelSelectClassName} value={sender} onChange={(e) => setSender(e.target.value)}>
            {(dataQ.data?.filters.senders ?? []).map((s) => <option key={s.id} value={s.id}>{s.fio}</option>)}
          </FilterSelect>
        </PayrollFilterField>
        <PayrollFilterField label="Отправлен с">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={cn(PAYROLL_FILTER_CONTROL, "w-40")} />
        </PayrollFilterField>
        <PayrollFilterField label="Отправлен по">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={cn(PAYROLL_FILTER_CONTROL, "w-40")} />
        </PayrollFilterField>
      </PayrollFiltersSection>
      {notice.element}

      <PayrollTableCard
        tabs={TABS.map((t) => (
          <PayrollCardTab key={t.key} active={tab === t.key} onClick={() => { setTab(t.key); sel.clear(); }}>
            {t.label}
          </PayrollCardTab>
        ))}
      >
        <PayrollTableToolbar
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Поиск: ФИО, код, филиал"
          onRefresh={refresh}
          refreshing={dataQ.isFetching}
        >
          <span className="text-sm text-muted-foreground">
            {dataQ.data?.totals.count ?? 0} шт. · <b className="text-foreground">{money(dataQ.data?.totals.amount ?? 0)}</b>
          </span>
        </PayrollTableToolbar>

        {canApprove && selected.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-sm sm:px-4">
            <span className="font-medium">Выбрано: {selected.length} · {money(selSum)}</span>
            {tab === "sent" ? (
              <>
                <Button size="sm" onClick={() => void run("approve", selected.map((r) => r.id), selSum)}>Утвердить</Button>
                <Button size="sm" variant="outline" onClick={() => void run("reject", selected.map((r) => r.id), selSum)}>Отклонить</Button>
              </>
            ) : null}
            {tab === "sent" || tab === "approved" ? (
              <Button size="sm" variant="outline" onClick={() => void run("cancel", selected.map((r) => r.id), selSum)}>Отменить</Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={sel.clear}>Снять выбор</Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className={cn(TH, "w-10")}>
                  <input type="checkbox" className="accent-primary" checked={pageAllOn} onChange={(e) => sel.setAll(paged.pageRows.map((r) => r.id), e.target.checked)} aria-label="Выбрать все" />
                </th>
                <th className={TH}>Сотрудник</th>
                <th className={TH}>Филиал</th>
                <th className={TH}>Месяц</th>
                <th className={cn(TH, "text-right")}>Сумма</th>
                <th className={TH}>Создал</th>
                <th className={TH}>Отправил</th>
                <th className={TH}>Решение</th>
                <th className={TH}>Статус</th>
                <th className={cn(TH, "w-24 text-center")}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {dataQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={10} loading={dataQ.isLoading} /> : null}
              {paged.pageRows.map((r) => (
                <tr key={r.id} className={cn("border-b border-border/60 hover:bg-muted/40", sel.ids.has(r.id) && "bg-primary/5")}>
                  <td className={TD}>
                    <input type="checkbox" className="accent-primary" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} aria-label={r.fio} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium text-foreground">{r.fio}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                    {r.comment ? <div className="text-[11px] text-muted-foreground">{r.comment}</div> : null}
                  </td>
                  <td className={TD}>{r.branch ?? "—"}</td>
                  <td className={cn(TD, "text-xs")}>{ymLabel(r)}</td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{money(r.amount)}</td>
                  <td className={cn(TD, "text-xs")}>
                    {r.created_by ?? "—"}
                    <div className="text-muted-foreground">{fmtDateTime(r.created_at)}</div>
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {r.sent_by ?? "—"}
                    <div className="text-muted-foreground">{fmtDateTime(r.sent_at)}</div>
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {r.approved_at ? (
                      <>
                        {r.approved_by}
                        <div className="text-muted-foreground">{fmtDateTime(r.approved_at)}</div>
                      </>
                    ) : null}
                    {r.rejected_at ? (
                      <>
                        {r.rejected_by}
                        <div className="text-muted-foreground">{fmtDateTime(r.rejected_at)}</div>
                        <div className="text-red-700">{r.reject_reason}</div>
                      </>
                    ) : null}
                  </td>
                  <td className={TD}><StatusBadge map={ADVANCE_STATUS} status={r.status} /></td>
                  <td className={cn(TD, "text-center")}>
                    {canApprove && r.status === "sent" ? (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Утвердить" onClick={() => void run("approve", [r.id], r.amount)}>
                          <Check className="size-4 text-emerald-700" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Отклонить" onClick={() => void run("reject", [r.id], r.amount)}>
                          <X className="size-4 text-red-700" />
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>
      {dialog}
    </PageShell>
  );
}
