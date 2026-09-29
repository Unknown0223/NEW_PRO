"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ChevronsLeftRight, CopyPlus, FileDiff, Lock, RefreshCw, Unlock } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, RECORD_STATUS, roleLabel, ymLabel, ymQuery, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollHealthBanner } from "@/components/payroll/payroll-health-banner";
import { PAYROLL_FILTER_TRIGGER, PayrollFilterCard, PayrollFloatSelect, PayrollRelatedBar } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollPagination, PayrollTableCard, PayrollTableToolbar, usePagedRows } from "@/components/payroll/kit/payroll-kit-table";
import { PayrollSheetTable, SHEET_COLUMNS, type SheetColumn, type SheetGroup, type SheetRow, type SheetTotals } from "@/components/payroll/payroll-sheet-table";
import { PayrollRecordDialog } from "@/components/payroll/payroll-record-dialog";
import { PayrollTransferDialog } from "@/components/payroll/payroll-transfer-dialog";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

type Records = { period: { status: string; closed_at: string | null }; columns: SheetColumn[]; rows: SheetRow[]; totals: SheetTotals };
type StatusAction = "submit" | "confirm" | "reject" | "reopen";
type Filters = { role: string; branches: string[]; status: string };

const ACTION_LABEL: Record<StatusAction, string> = { submit: "На проверку", confirm: "Подтвердить", reject: "Отклонить", reopen: "Вернуть в черновик" };
const COLUMN_IDS = SHEET_COLUMNS.map((c) => c.id);
const ALL_GROUPS: SheetGroup[] = ["allowances", "deductions", "payments"];

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
  const [draftRole, setDraftRole] = useState("");
  const [draftBranches, setDraftBranches] = useState<Set<string>>(new Set());
  const [draftStatus, setDraftStatus] = useState("");
  const [filters, setFilters] = useState<Filters>({ role: "", branches: [], status: "" });
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<SheetGroup>>(new Set(["allowances", "deductions"]));
  const [colsOpen, setColsOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.sheet.v2", defaultColumnOrder: COLUMN_IDS, defaultPageSize: 20 });

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (filters.role) p.set("roles", filters.role);
    if (filters.branches.length) p.set("branches", filters.branches.join(","));
    if (filters.status) p.set("statuses", filters.status);
    return p.toString();
  }, [ym, filters]);

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
    return (data?.rows ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s));
  }, [data, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${q}`);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-records", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-health", tenant] });
  };

  const applyFilters = () => {
    setFilters({ role: draftRole, branches: [...draftBranches], status: draftStatus });
    sel.clear();
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
    mutationFn: (p: { action: StatusAction; reason?: string }) =>
      api.send<{ changed: number; skipped: unknown[] }>("POST", `/records/${p.action}`, { ids: sel.list, reason: p.reason ?? null }),
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
    const ok = await confirm({
      title: ACTION_LABEL[action],
      message: `${ACTION_LABEL[action]} — выбрано записей: ${sel.list.length}?`,
      confirmLabel: "Да",
      cancelLabel: "Отмена",
      destructive: action === "reopen"
    });
    if (ok) changeStatus.mutate({ action });
  };

  const period = useMutation({
    mutationFn: (p: { action: "close" | "reopen"; confirm_all?: boolean }) =>
      api.send("POST", `/periods/${ymToInput(ym)}/${p.action}`, { confirm_all: p.confirm_all }),
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

  const allExpanded = ALL_GROUPS.every((g) => expanded.has(g));
  const toggleGroup = (g: SheetGroup) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <PageShell>
      <PayrollRelatedBar current="salary" />
      <PayrollFilterCard
        title="Зарплата"
        description="Считается автоматически: табель, KPI (доставлено − возвраты), формулы, авансы и выплаты кассы."
        month={{ value: ym, onChange: (v) => { setYm(v); sel.clear(); } }}
        fxHref="/users/salary/formulas"
        onApply={applyFilters}
      >
        <SearchableMultiSelectPanel<string>
          label="Филиалы"
          hideOuterLabel
          triggerPlaceholder="Филиалы"
          triggerClassName={PAYROLL_FILTER_TRIGGER}
          items={(filtersQ.data?.branches ?? []).map((b) => ({ id: b, title: b }))}
          selected={draftBranches}
          onSelectedChange={setDraftBranches}
          className="w-[220px]"
        />
        <PayrollFloatSelect
          label="Роль"
          value={draftRole}
          onChange={setDraftRole}
          options={(filtersQ.data?.roles ?? []).map((r) => ({ value: r, label: roleLabel(r) }))}
        />
        <PayrollFloatSelect
          label="Статус"
          value={draftStatus}
          onChange={setDraftStatus}
          options={Object.entries(RECORD_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </PayrollFilterCard>

      <PayrollHealthBanner ym={ym} />
      {notice.element}

      <PayrollTableCard>
        <PayrollTableToolbar
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          onColumns={() => setColsOpen(true)}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Поиск по ФИО, коду, филиалу"
          onRefresh={refresh}
          refreshing={recordsQ.isFetching}
          onExport={() => void exportXlsx()}
        >
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", closed ? "bg-zinc-800 text-white" : "bg-emerald-100 text-emerald-800")}>
            {closed ? "Месяц закрыт" : "Месяц открыт"}
          </span>
          {can("staff.zarplaty.approve") ? (
            <Button size="sm" variant="outline" className="h-9" disabled={!sel.list.length || changeStatus.isPending} onClick={() => void runStatus("confirm")}>
              <CheckCheck className="mr-1 size-4" /> Подтвердить все{sel.list.length ? ` (${sel.list.length})` : ""}
            </Button>
          ) : null}
          {can("staff.zarplaty.update") && !closed ? (
            <Button size="sm" variant="outline" className="h-9" disabled={recalc.isPending} onClick={() => recalc.mutate()}>
              <RefreshCw className={cn("mr-1 size-4", recalc.isPending && "animate-spin")} /> Пересчитать
            </Button>
          ) : null}
          {can("staff.zarplaty.copy") && !closed ? (
            <Button size="sm" variant="outline" className="h-9" onClick={() => setTransferOpen(true)}>
              <CopyPlus className="mr-1 size-4" /> Перенос данных
            </Button>
          ) : null}
          <Link href="/users/salary/compare" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
            <FileDiff className="mr-1 size-4" /> Сверка с Excel
          </Link>
          {can("staff.zarplaty.approve") ? (
            closed ? (
              <Button size="sm" variant="outline" className="h-9" onClick={() => period.mutate({ action: "reopen" })}>
                <Unlock className="mr-1 size-4" /> Открыть месяц
              </Button>
            ) : (
              <Button size="sm" className="h-9" onClick={() => void closeMonth()} disabled={!data?.rows.length}>
                <Lock className="mr-1 size-4" /> Закрыть месяц
              </Button>
            )
          ) : null}
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9"
            title={allExpanded ? "Свернуть все группы" : "Развернуть все группы"}
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(ALL_GROUPS))}
          >
            <ChevronsLeftRight className="size-4" />
          </Button>
        </PayrollTableToolbar>

        {sel.list.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-sm sm:px-4">
            <span className="font-medium">Выбрано: {sel.list.length}</span>
            {can("staff.zarplaty.status") || can("staff.zarplaty.approve") ? (
              <Button size="sm" variant="outline" onClick={() => void runStatus("submit")}>На проверку</Button>
            ) : null}
            {can("staff.zarplaty.approve") ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void runStatus("reject")}>Отклонить</Button>
                <Button size="sm" variant="outline" onClick={() => void runStatus("reopen")}>Вернуть в черновик</Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={sel.clear}>Снять выбор</Button>
          </div>
        ) : null}

        <PayrollSheetTable
          columns={data?.columns ?? []}
          rows={paged.pageRows}
          allRows={rows}
          totals={data?.totals ?? null}
          loading={recordsQ.isLoading}
          hidden={prefs.hiddenColumnIds}
          expanded={expanded}
          onToggleGroup={toggleGroup}
          selected={sel.ids}
          onToggle={sel.toggle}
          onToggleAll={(on) => sel.setAll(paged.pageRows.map((r) => r.id), on)}
          onOpen={(r) => setOpenId(r.id)}
        />
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>

      <TableColumnSettingsDialog
        open={colsOpen}
        onOpenChange={setColsOpen}
        title="Столбцы таблицы"
        description="ФИО отображается всегда."
        columns={[...SHEET_COLUMNS]}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        onSave={prefs.saveColumnLayout}
        onReset={prefs.resetColumnLayout}
        saving={prefs.saving}
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
