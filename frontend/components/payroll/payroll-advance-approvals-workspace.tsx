"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, fmtDateTime, inputToYm, money, payrollApi, roleLabel, ymLabel } from "@/lib/payroll/payroll-api";
import { EmptyRow, selectCls, StatusBadge, Toolbar, useNotice, useSelection } from "@/components/payroll/payroll-ui";

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
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [tab, month, branch, sender, dateFrom, dateTo, q]);

  const dataQ = useQuery({
    queryKey: ["payroll-advance-approvals", tenant, params],
    enabled: Boolean(tenant),
    refetchInterval: 30_000,
    queryFn: () => api.get<Data>(`/advance-approvals?${params}`)
  });
  const rows = dataQ.data?.rows ?? [];
  const selected = rows.filter((r) => sel.ids.has(r.id));
  const selSum = selected.reduce((s, r) => s + r.amount, 0);

  const act = useMutation({
    mutationFn: (p: { action: "approve" | "reject" | "cancel"; ids: number[]; reason?: string }) =>
      api.send<Record<string, unknown>>("POST", `/advance-approvals/${p.action}`, { ids: p.ids, reason: p.reason }),
    onSuccess: (r, p) => {
      const key = p.action === "approve" ? "approved" : p.action === "reject" ? "rejected" : "cancelled";
      const skipped = Array.isArray(r?.skipped) ? (r.skipped as Array<{ reason?: string }>) : [];
      const label = p.action === "approve" ? "Утверждено" : p.action === "reject" ? "Отклонено" : "Отменено";
      notice.ok(`${label}: ${Number(r?.[key] ?? 0)}${skipped.length ? `\nПропущено ${skipped.length}: ${[...new Set(skipped.map((s) => s.reason))].join(", ")}` : ""}`);
      sel.clear();
      void qc.invalidateQueries({ queryKey: ["payroll-advance-approvals", tenant] });
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

  return (
    <PageShell>
      <PageHeader title="Утверждение авансов" description="Авансы, отправленные руководителями. Утверждённые попадают в очередь кассира филиала по времени утверждения." />
      {notice.element}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "outline"} onClick={() => { setTab(t.key); sel.clear(); }}>{t.label}</Button>
        ))}
      </div>
      <Toolbar>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-40" title="Месяц (пусто — все)" />
        <select className={selectCls("w-44")} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Все филиалы</option>
          {(dataQ.data?.filters.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={selectCls("w-48")} value={sender} onChange={(e) => setSender(e.target.value)}>
          <option value="">Все отправители</option>
          {(dataQ.data?.filters.senders ?? []).map((s) => <option key={s.id} value={s.id}>{s.fio}</option>)}
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" title="Отправлен с" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" title="Отправлен по" />
        <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-44" />
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {dataQ.data?.totals.count ?? 0} шт. · <b className="text-foreground">{money(dataQ.data?.totals.amount ?? 0)}</b>
        </span>
      </Toolbar>

      {canApprove && selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>Выбрано: {selected.length} · {money(selSum)}</span>
          {tab === "sent" ? (
            <>
              <Button size="sm" onClick={() => void run("approve", selected.map((r) => r.id), selSum)}>Утвердить</Button>
              <Button size="sm" variant="outline" onClick={() => void run("reject", selected.map((r) => r.id), selSum)}>Отклонить</Button>
            </>
          ) : null}
          {tab === "sent" || tab === "approved" ? <Button size="sm" variant="outline" onClick={() => void run("cancel", selected.map((r) => r.id), selSum)}>Отменить</Button> : null}
          <Button size="sm" variant="ghost" onClick={sel.clear}>Снять выбор</Button>
        </div>
      ) : null}

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-xs">
            <tr>
              <th className="w-8 px-2 py-2"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => sel.setAll(rows.map((r) => r.id), e.target.checked)} /></th>
              <th className="px-2">Сотрудник</th>
              <th className="px-2">Филиал</th>
              <th className="px-2">Месяц</th>
              <th className="px-2 text-right">Сумма</th>
              <th className="px-2">Создал</th>
              <th className="px-2">Отправил</th>
              <th className="px-2">Решение</th>
              <th className="px-2">Статус</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {dataQ.isLoading ? <EmptyRow colSpan={10} text="Загрузка…" /> : null}
            {!dataQ.isLoading && rows.length === 0 ? <EmptyRow colSpan={10} /> : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2"><input type="checkbox" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} /></td>
                <td className="px-2 py-2">
                  <div className="font-medium">{r.fio}</div>
                  <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}</div>
                  {r.comment ? <div className="text-[11px] text-muted-foreground">{r.comment}</div> : null}
                </td>
                <td className="px-2 py-2">{r.branch ?? "—"}</td>
                <td className="px-2 py-2 text-xs">{ymLabel(r)}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">{money(r.amount)}</td>
                <td className="px-2 py-2 text-xs">{r.created_by ?? "—"}<div className="text-muted-foreground">{fmtDateTime(r.created_at)}</div></td>
                <td className="px-2 py-2 text-xs">{r.sent_by ?? "—"}<div className="text-muted-foreground">{fmtDateTime(r.sent_at)}</div></td>
                <td className="px-2 py-2 text-xs">
                  {r.approved_at ? <>{r.approved_by}<div className="text-muted-foreground">{fmtDateTime(r.approved_at)}</div></> : null}
                  {r.rejected_at ? <>{r.rejected_by}<div className="text-muted-foreground">{fmtDateTime(r.rejected_at)}</div><div className="text-red-700">{r.reject_reason}</div></> : null}
                </td>
                <td className="px-2 py-2"><StatusBadge map={ADVANCE_STATUS} status={r.status} /></td>
                <td className="px-2 py-1 text-right">
                  {canApprove && r.status === "sent" ? (
                    <div className="flex justify-end">
                      <Button size="icon" variant="ghost" aria-label="Утвердить" onClick={() => void run("approve", [r.id], r.amount)}><Check className="size-4 text-emerald-700" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Отклонить" onClick={() => void run("reject", [r.id], r.amount)}><X className="size-4 text-red-700" /></Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </PageShell>
  );
}
