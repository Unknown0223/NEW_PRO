"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Download, Lock, RefreshCw, Unlock } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, RECORD_STATUS, roleLabel, ymLabel, ymQuery, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { MonthField, selectCls, Toolbar, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollHealthBanner } from "@/components/payroll/payroll-health-banner";
import { PayrollSheetTable, type SheetColumn, type SheetRow, type SheetTotals } from "@/components/payroll/payroll-sheet-table";
import { PayrollRecordDialog } from "@/components/payroll/payroll-record-dialog";
import { PayrollTransferDialog } from "@/components/payroll/payroll-transfer-dialog";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

type Records = { period: { status: string; closed_at: string | null }; columns: SheetColumn[]; rows: SheetRow[]; totals: SheetTotals };
type StatusAction = "submit" | "confirm" | "reject" | "reopen";

const ACTION_LABEL: Record<StatusAction, string> = { submit: "На проверку", confirm: "Подтвердить", reject: "Отклонить", reopen: "Вернуть в черновик" };

export function PayrollSheetWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const can = (k: string) => perms.isAdmin || perms.has(k);
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [role, setRole] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (role) p.set("roles", role);
    if (branch) p.set("branches", branch);
    if (status) p.set("statuses", status);
    return p.toString();
  }, [ym, role, branch, status]);

  const recordsQ = useQuery({
    queryKey: ["payroll-records", tenant, params],
    enabled: Boolean(tenant),
    refetchInterval: (query) => ((query.state.data as Records | undefined)?.rows.some((r) => r.dirty) ? 10_000 : 60_000),
    queryFn: () => api.get<Records>(`/records?${params}`)
  });
  const filtersQ = useQuery({
    queryKey: ["payroll-record-filters", tenant, ym.year, ym.month],
    enabled: Boolean(tenant),
    queryFn: () => api.get<{ roles: string[]; branches: string[] }>(`/records/filters?${ymQuery(ym)}`)
  });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });

  const data = recordsQ.data;
  const closed = data?.period.status === "closed";
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""}`.toLowerCase().includes(s));
  }, [data, q]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-records", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-health", tenant] });
  };

  const recalc = useMutation({
    mutationFn: () => {
      const userIds = sel.list.length ? rows.filter((r) => sel.ids.has(r.id)).map((r) => r.user_id) : undefined;
      return api.send<{ mode: string }>("POST", "/records/recalc", { ...ym, user_ids: userIds });
    },
    onSuccess: (r) => {
      notice.ok(r.mode === "async" ? "Пересчёт запущен — таблица обновится через минуту" : "Пересчитано");
      refresh();
    },
    onError: notice.fail
  });

  const changeStatus = useMutation({
    mutationFn: (p: { action: StatusAction; reason?: string }) => api.send<{ changed: number; skipped: unknown[] }>("POST", `/records/${p.action}`, { ids: sel.list, reason: p.reason ?? null }),
    onSuccess: (r, p) => {
      notice.ok(`${ACTION_LABEL[p.action]}: ${r?.changed ?? 0}${r?.skipped?.length ? `, пропущено ${r.skipped.length}` : ""}`);
      sel.clear();
      refresh();
    },
    onError: notice.fail
  });

  const runStatus = async (action: StatusAction) => {
    if (action === "reject") {
      const reason = window.prompt("Причина отклонения");
      if (!reason?.trim()) return;
      changeStatus.mutate({ action, reason: reason.trim() });
      return;
    }
    const ok = await confirm({ title: ACTION_LABEL[action], message: `${ACTION_LABEL[action]} — выбрано записей: ${sel.list.length}?`, confirmLabel: "Да", cancelLabel: "Отмена", destructive: action === "reopen" });
    if (ok) changeStatus.mutate({ action });
  };

  const period = useMutation({
    mutationFn: (p: { action: "close" | "reopen"; confirm_all?: boolean }) => api.send("POST", `/periods/${ymToInput(ym)}/${p.action}`, { confirm_all: p.confirm_all }),
    onSuccess: (_r, p) => {
      notice.ok(p.action === "close" ? "Месяц закрыт. Табель заблокирован, изменения пойдут корректировкой в следующий месяц." : "Месяц открыт");
      refresh();
    },
    onError: notice.fail
  });

  const closeMonth = async () => {
    const unconfirmed = (data?.rows ?? []).filter((r) => r.status !== "confirmed").length;
    const ok = await confirm({
      title: `Закрыть ${ymLabel(ym)}`,
      message: unconfirmed
        ? `Не подтверждено записей: ${unconfirmed}. Они будут подтверждены автоматически. После закрытия изменения попадут корректировкой в следующий месяц.`
        : "После закрытия изменения попадут корректировкой в следующий месяц.",
      confirmLabel: "Закрыть месяц",
      cancelLabel: "Отмена",
      destructive: true
    });
    if (ok) period.mutate({ action: "close", confirm_all: unconfirmed > 0 });
  };

  const exportXlsx = async () => {
    try {
      const r = await api.get<{ header: string[]; rows: unknown[][] }>(`/export?${params}`);
      await downloadXlsx(`zarplata-${ymToInput(ym)}.xlsx`, r.header, r.rows, ymLabel(ym));
    } catch (e) {
      notice.fail(e);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Зарплата"
        description="Считается автоматически: табель, KPI (доставлено − возвраты), формулы, авансы и выплаты кассы."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/users/salary/compare" className={buttonVariants({ variant: "outline", size: "sm" })}>Сверка с Excel</Link>
            <Button variant="outline" size="sm" onClick={() => void exportXlsx()}><Download className="mr-1 size-4" /> Excel</Button>
          </div>
        }
      />
      <PayrollHealthBanner ym={ym} />
      {notice.element}
      <Toolbar>
        <MonthField value={ym} onChange={(v) => { setYm(v); sel.clear(); }} />
        <select className={selectCls("w-40")} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Все роли</option>
          {(filtersQ.data?.roles ?? []).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <select className={selectCls("w-44")} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Все филиалы</option>
          {(filtersQ.data?.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={selectCls("w-40")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(RECORD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-52" />
        <div className="flex-1" />
        <span className={cn("rounded-full px-2 py-1 text-xs", closed ? "bg-zinc-800 text-white" : "bg-emerald-100 text-emerald-800")}>
          {closed ? "Месяц закрыт" : "Месяц открыт"}
        </span>
        {can("staff.zarplaty.update") && !closed ? (
          <Button variant="outline" size="sm" disabled={recalc.isPending} onClick={() => recalc.mutate()}>
            <RefreshCw className={cn("mr-1 size-4", recalc.isPending && "animate-spin")} /> Пересчитать{sel.list.length ? ` (${sel.list.length})` : ""}
          </Button>
        ) : null}
        {can("staff.zarplaty.copy") && !closed ? (
          <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}><CopyPlus className="mr-1 size-4" /> Перенос</Button>
        ) : null}
        {can("staff.zarplaty.approve") ? (
          closed ? (
            <Button variant="outline" size="sm" onClick={() => period.mutate({ action: "reopen" })}><Unlock className="mr-1 size-4" /> Открыть месяц</Button>
          ) : (
            <Button size="sm" onClick={() => void closeMonth()} disabled={!data?.rows.length}><Lock className="mr-1 size-4" /> Закрыть месяц</Button>
          )
        ) : null}
      </Toolbar>

      {sel.list.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>Выбрано: {sel.list.length}</span>
          {can("staff.zarplaty.status") || can("staff.zarplaty.approve") ? <Button size="sm" variant="outline" onClick={() => void runStatus("submit")}>На проверку</Button> : null}
          {can("staff.zarplaty.approve") ? (
            <>
              <Button size="sm" onClick={() => void runStatus("confirm")}>Подтвердить</Button>
              <Button size="sm" variant="outline" onClick={() => void runStatus("reject")}>Отклонить</Button>
              <Button size="sm" variant="outline" onClick={() => void runStatus("reopen")}>Вернуть в черновик</Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={sel.clear}>Снять выбор</Button>
        </div>
      ) : null}

      <PayrollSheetTable
        columns={data?.columns ?? []}
        rows={rows}
        totals={data?.totals ?? null}
        loading={recordsQ.isLoading}
        selected={sel.ids}
        onToggle={sel.toggle}
        onToggleAll={(on) => sel.setAll(rows.map((r) => r.id), on)}
        onOpen={(r) => setOpenId(r.id)}
      />
      <PayrollRecordDialog recordId={openId} items={itemsQ.data ?? []} onClose={() => { setOpenId(null); refresh(); }} />
      <PayrollTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        to={ym}
        items={itemsQ.data ?? []}
        userIds={rows.filter((r) => sel.ids.has(r.id)).map((r) => r.user_id)}
        onDone={(t) => { notice.ok(t); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}
