"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, fmtDateTime, money, payrollApi, roleLabel, ymLabel, type Ym } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { StatusBadge, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollFilterCard, PayrollFloatInput, PayrollFloatSelect, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction,
  PayrollPagination,
  PayrollSelectionBar,
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
type Tab = "sent" | "approved" | "paid" | "rejected";
type Filters = { branch: string; sender: string; dateFrom: string; dateTo: string };

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "sent", label: "На утверждении" },
  { id: "approved", label: "Утверждены (ждут выдачи)" },
  { id: "paid", label: "Выданы" },
  { id: "rejected", label: "Отклонены" }
];
const EMPTY: Filters = { branch: "", sender: "", dateFrom: "", dateTo: "" };

export function PayrollAdvanceApprovalsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canApprove = perms.isAdmin || perms.has("finance.avans.approve");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [tab, setTab] = useState<Tab>("sent");
  const [ym, setYm] = useState<Ym | null>(null);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [q, setQ] = useState("");
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advance-approvals", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const params = useMemo(() => {
    const p = new URLSearchParams({ status: TABS.map((t) => t.id).join(",") });
    if (ym) {
      p.set("year", String(ym.year));
      p.set("month", String(ym.month));
    }
    if (filters.branch) p.set("branch", filters.branch);
    if (filters.sender) p.set("sent_by", filters.sender);
    if (filters.dateFrom) p.set("date_from", `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) p.set("date_to", `${filters.dateTo}T23:59:59`);
    return p.toString();
  }, [ym, filters]);

  const dataQ = useQuery({
    queryKey: ["payroll-advance-approvals", tenant, params],
    enabled: Boolean(tenant),
    refetchInterval: 30_000,
    queryFn: () => api.get<Data>(`/advance-approvals?${params}`)
  });
  const all = useMemo(() => dataQ.data?.rows ?? [], [dataQ.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) => r.status === tab && (!s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s)));
  }, [all, tab, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${tab}|${q}`);
  const selected = rows.filter((r) => sel.ids.has(r.id));
  const selSum = selected.reduce((s, r) => s + r.amount, 0);
  const tabSum = rows.reduce((s, r) => s + r.amount, 0);
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
      void qc.invalidateQueries({ queryKey: ["payroll-cashier-queue", tenant] });
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

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        "utverzhdenie-avansov.xlsx",
        ["Сотрудник", "Код", "Филиал", "Месяц", "Сумма", "Создал", "Отправил", "Статус", "Причина"],
        rows.map((r) => [r.fio, r.code ?? "", r.branch ?? "", ymLabel(r), r.amount, r.created_by ?? "", r.sent_by ?? "", ADVANCE_STATUS[r.status]?.label ?? r.status, r.reject_reason ?? ""]),
        TABS.find((t) => t.id === tab)?.label ?? "Авансы"
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  const pageAllOn = paged.pageRows.length > 0 && paged.pageRows.every((r) => sel.ids.has(r.id));
  const ids = selected.map((r) => r.id);

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="approvals" />
      <PayrollFilterCard
        title="Утверждение авансов"
        description="Авансы, отправленные руководителями. Утверждённые попадают в очередь кассира филиала по времени утверждения."
        month={{ value: ym, onChange: (v) => { setYm(v); sel.clear(); }, onClear: () => { setYm(null); sel.clear(); } }}
        onApply={() => { setFilters(draft); sel.clear(); }}
      >
        <PayrollFloatSelect
          label="Филиал"
          value={draft.branch}
          onChange={(v) => setDraft((d) => ({ ...d, branch: v }))}
          options={(dataQ.data?.filters.branches ?? []).map((b) => ({ value: b, label: b }))}
        />
        <PayrollFloatSelect
          label="Отправитель"
          value={draft.sender}
          onChange={(v) => setDraft((d) => ({ ...d, sender: v }))}
          options={(dataQ.data?.filters.senders ?? []).map((s) => ({ value: String(s.id), label: s.fio }))}
        />
        <PayrollFloatInput type="date" label="Отправлен с" value={draft.dateFrom} onChange={(v) => setDraft((d) => ({ ...d, dateFrom: v }))} />
        <PayrollFloatInput type="date" label="Отправлен по" value={draft.dateTo} onChange={(v) => setDraft((d) => ({ ...d, dateTo: v }))} />
      </PayrollFilterCard>
      <PayrollSegmentedTabs<Tab>
        tabs={TABS.map((t) => ({ ...t, count: all.filter((r) => r.status === t.id).length }))}
        value={tab}
        onChange={(v) => { setTab(v); sel.clear(); }}
      />
      {notice.element}

      <PayrollTableCard>
        <PayrollTableToolbar
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Поиск: ФИО, код, филиал"
          onRefresh={refresh}
          refreshing={dataQ.isFetching}
          onExport={() => void exportXlsx()}
        >
          <span className="text-sm text-muted-foreground">
            {rows.length} шт. · <b className="text-foreground">{money(tabSum)}</b>
          </span>
          {canApprove && tab === "sent" ? (
            <Button className="h-9" disabled={!selected.length || act.isPending} onClick={() => void run("approve", ids, selSum)}>
              <Check className="mr-1.5 size-4" /> Утвердить{selected.length ? ` (${selected.length})` : ""}
            </Button>
          ) : null}
        </PayrollTableToolbar>

        {canApprove ? (
          <PayrollSelectionBar count={selected.length} extra={` · ${money(selSum)}`} onClear={sel.clear}>
            {tab === "sent" ? (
              <Button size="sm" variant="outline" onClick={() => void run("reject", ids, selSum)}>Отклонить</Button>
            ) : null}
            {tab === "sent" || tab === "approved" ? (
              <Button size="sm" variant="outline" onClick={() => void run("cancel", ids, selSum)}>Отменить</Button>
            ) : null}
          </PayrollSelectionBar>
        ) : null}

        <div className="overflow-x-auto">
          <table className={PAYROLL_TABLE}>
            <thead className={PAYROLL_THEAD}>
              <tr>
                <th className={cn(TH, "w-10")}>
                  <input type="checkbox" className="size-4 accent-primary" checked={pageAllOn} onChange={(e) => sel.setAll(paged.pageRows.map((r) => r.id), e.target.checked)} aria-label="Выбрать все" />
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
                <tr key={r.id} className={cn(PAYROLL_TR, sel.ids.has(r.id) && "bg-primary/5")}>
                  <td className={TD}>
                    <input type="checkbox" className="size-4 accent-primary" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} aria-label={r.fio} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium text-foreground">{r.fio}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                    {r.comment ? <div className="text-[11px] text-muted-foreground">{r.comment}</div> : null}
                  </td>
                  <td className={cn(TD, "text-muted-foreground")}>{r.branch ?? "—"}</td>
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
                    {!r.approved_at && !r.rejected_at ? <span className="text-muted-foreground/60">—</span> : null}
                  </td>
                  <td className={TD}><StatusBadge map={ADVANCE_STATUS} status={r.status} /></td>
                  <td className={cn(TD, "text-center")}>
                    {canApprove && r.status === "sent" ? (
                      <div className="inline-flex gap-1.5">
                        <PayrollIconAction label="Утвердить" tone="success" onClick={() => void run("approve", [r.id], r.amount)}>
                          <Check className="size-4" />
                        </PayrollIconAction>
                        <PayrollIconAction label="Отклонить" tone="danger" onClick={() => void run("reject", [r.id], r.amount)}>
                          <X className="size-4" />
                        </PayrollIconAction>
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
