"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, FileDiff, Lock, Maximize2, Minimize2, Pencil, RefreshCw, Unlock } from "lucide-react";
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
import { PayrollPagination, PayrollTableCard, PayrollTableToolbar, usePagedRows, useSortedRows } from "@/components/payroll/kit/payroll-kit-table";
import { PayrollMoreMenu } from "@/components/payroll/kit/payroll-kit-menu";
import {
  PayrollSheetTable,
  SHEET_COLUMNS,
  sheetSortValue,
  type SheetColumn,
  type SheetGroup,
  type SheetRow,
  type SheetSortKey,
  type SheetTotals
} from "@/components/payroll/payroll-sheet-table";
import { PayrollRecordDialog } from "@/components/payroll/payroll-record-dialog";
import { PayrollTransferDialog } from "@/components/payroll/payroll-transfer-dialog";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

type Records = { period: { status: string; closed_at: string | null }; columns: SheetColumn[]; rows: SheetRow[]; totals: SheetTotals };
type StatusAction = "submit" | "confirm" | "reject" | "reopen";
type Filters = { role: string; branches: string[]; status: string; direction: string; position: string };
type FilterOptions = { roles: string[]; branches: string[]; positions: string[]; directions: Array<{ id: number; name: string }> };
const EMPTY_FILTERS: Filters = { role: "", branches: [], status: "", direction: "", position: "" };

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
  const [draft, setDraft] = useState<Omit<Filters, "branches">>(EMPTY_FILTERS);
  const [draftBranches, setDraftBranches] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
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
    if (filters.direction) p.set("directions", filters.direction);
    if (filters.position) p.set("positions", filters.position);
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
    queryFn: () => api.get<FilterOptions>(`/records/filters?${ymQuery(ym)}`)
  });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });

  const data = recordsQ.data;
  const closed = data?.period.status === "closed";
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s));
  }, [data, q]);
  const { sorted: rows, sort, toggle: toggleSort } = useSortedRows<SheetRow, SheetSortKey>(filtered, sheetSortValue);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${q}|${sort?.key ?? ""}|${sort?.dir ?? ""}`);
  const selectedRows = rows.filter((r) => sel.ids.has(r.id));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-records", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-health", tenant] });
  };

  const applyFilters = () => {
    setFilters({ ...draft, branches: [...draftBranches] });
    sel.clear();
  };

  const recalc = useMutation({
    mutationFn: () => {
      const userIds = sel.list.length ? selectedRows.map((r) => r.user_id) : undefined;
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
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="salary" />
      <PayrollFilterCard
        title="Зарплата"
        actions={
          <span
            className={cn("rounded-full px-2.5 py-1 text-xs font-medium", closed ? "bg-zinc-800 text-white" : "bg-primary/10 text-primary")}
            title="Считается автоматически: табель, KPI (доставлено − возвраты), формулы, авансы и выплаты кассы."
          >
            {closed ? "Месяц закрыт" : "Месяц открыт"}
          </span>
        }
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
          value={draft.role}
          onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
          options={(filtersQ.data?.roles ?? []).map((r) => ({ value: r, label: roleLabel(r) }))}
        />
        <PayrollFloatSelect
          label="Направление торговли"
          value={draft.direction}
          onChange={(v) => setDraft((d) => ({ ...d, direction: v }))}
          options={(filtersQ.data?.directions ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
        />
        <PayrollFloatSelect
          label="Должность"
          value={draft.position}
          onChange={(v) => setDraft((d) => ({ ...d, position: v }))}
          options={(filtersQ.data?.positions ?? []).map((p) => ({ value: p, label: p }))}
        />
        <PayrollFloatSelect
          label="Статус"
          value={draft.status}
          onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
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
          searchPlaceholder="Поиск"
          onRefresh={refresh}
          refreshing={recordsQ.isFetching}
          onExport={() => void exportXlsx()}
        >
          {can("staff.zarplaty.approve") ? (
            <Button className="h-9" disabled={!sel.list.length || changeStatus.isPending} onClick={() => void runStatus("confirm")}>
              Подтвердить все{sel.list.length ? ` (${sel.list.length})` : ""}
            </Button>
          ) : null}
          <Link href="/users/salary/formulas" className={cn(buttonVariants(), "h-9")}>
            Установка формулу
          </Link>
          {can("staff.zarplaty.copy") && !closed ? (
            <Button variant="outline" className="h-9" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="mr-1.5 size-4" /> Перенос данных
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-9"
            disabled={selectedRows.length !== 1}
            title={selectedRows.length === 1 ? undefined : "Выберите одного сотрудника (или нажмите на строку)"}
            onClick={() => setOpenId(selectedRows[0]?.id ?? null)}
          >
            <Pencil className="mr-1.5 size-4" /> Изменить зарплату
          </Button>
          <PayrollMoreMenu
            items={[
              ...(can("staff.zarplaty.update") && !closed
                ? [{ id: "recalc", label: "Пересчитать", icon: <RefreshCw className="size-4" />, disabled: recalc.isPending, onClick: () => recalc.mutate() }]
                : []),
              { id: "compare", label: "Сверка с Excel", icon: <FileDiff className="size-4" />, href: "/users/salary/compare" },
              ...(can("staff.zarplaty.approve")
                ? [
                    closed
                      ? { id: "reopen", label: "Открыть месяц", icon: <Unlock className="size-4" />, onClick: () => period.mutate({ action: "reopen" }) }
                      : { id: "close", label: "Закрыть месяц", icon: <Lock className="size-4" />, disabled: !data?.rows.length, destructive: true, onClick: () => void closeMonth() }
                  ]
                : [])
            ]}
          />
          <Button
            size="icon"
            variant="outline"
            className={cn("h-9 w-9", allExpanded && "border-primary/30 bg-primary/10 text-primary")}
            title={allExpanded ? "Свернуть все" : "Раскрыть все"}
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(ALL_GROUPS))}
          >
            {allExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
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
          sort={sort}
          onSort={toggleSort}
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
        userIds={selectedRows.map((r) => r.user_id)}
        onDone={(t) => { notice.ok(t); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}
