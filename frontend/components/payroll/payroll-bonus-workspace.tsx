"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, roleLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { useNotice, useSelection } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollBonusAssignDialog, type AssignTarget, type BonusFormula } from "@/components/payroll/payroll-bonus-assign-dialog";
import { PayrollBonusTable, type Assign, type BonusRow } from "@/components/payroll/payroll-bonus-table";
import { FORMULA_SCOPES } from "@/components/payroll/payroll-formula-editor";
import { PAYROLL_FILTER_TRIGGER, PayrollFilterCard, PayrollFloatSelect, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollEmptyRow, PayrollPagination, PayrollTableCard, PayrollTableToolbar, usePagedRows } from "@/components/payroll/kit/payroll-kit-table";

type BonusData = { closed: boolean; groups: Array<{ id: number; name: string }>; directions: Array<{ id: number; name: string }>; rows: BonusRow[] };
type Tab = "kpi" | "formulas";
type Filters = { role: string; users: number[]; group: string; direction: string };

const SCOPE_LABEL = Object.fromEntries(FORMULA_SCOPES.map((s) => [s.v, s.label])) as Record<string, string>;
const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5";

export function PayrollBonusWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canAssign = perms.isAdmin || perms.has("staff.zarplaty.assign");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [tab, setTab] = useState<Tab>("kpi");
  const [ym, setYm] = useState<Ym>(currentYm());
  const [draftRole, setDraftRole] = useState("");
  const [draftUsers, setDraftUsers] = useState<Set<number>>(new Set());
  const [draftGroup, setDraftGroup] = useState("");
  const [draftDirection, setDraftDirection] = useState("");
  const [filters, setFilters] = useState<Filters>({ role: "", users: [], group: "", direction: "" });
  const [q, setQ] = useState("");
  const [fq, setFq] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<AssignTarget | null>(null);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.bonus-kpi", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (filters.role) p.set("role", filters.role);
    if (filters.direction) p.set("trade_direction_id", filters.direction);
    return p.toString();
  }, [ym, filters.role, filters.direction]);

  const dataQ = useQuery({ queryKey: ["payroll-bonus-kpi", tenant, params], enabled: Boolean(tenant), queryFn: () => api.get<BonusData>(`/bonus-kpi?${params}`) });
  const allQ = useQuery({ queryKey: ["payroll-bonus-kpi", tenant, ymQuery(ym)], enabled: Boolean(tenant), queryFn: () => api.get<BonusData>(`/bonus-kpi?${ymQuery(ym)}`) });
  const formulasQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: Boolean(tenant), queryFn: () => api.get<BonusFormula[]>("/formulas") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const data = dataQ.data;
  const groups = data?.groups ?? [];
  const everyone = useMemo(() => allQ.data?.rows ?? [], [allQ.data]);
  const roles = useMemo(() => [...new Set(everyone.map((r) => r.role))].sort(), [everyone]);
  const editable = canAssign && !data?.closed;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const users = new Set(filters.users);
    return (data?.rows ?? []).filter((r) => (!users.size || users.has(r.user_id)) && (!s || `${r.fio} ${r.code ?? ""}`.toLowerCase().includes(s)));
  }, [data, q, filters.users]);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${q}|${filters.users.join()}`);

  const bonusFormulas = (formulasQ.data ?? []).filter((f) => f.scope === "bonus" || f.scope === "common");
  const formulaRows = bonusFormulas.filter((f) => !fq.trim() || `${f.name} ${f.text}`.toLowerCase().includes(fq.trim().toLowerCase()));
  const formulaPaged = usePagedRows(formulaRows, prefs.pageSize, fq);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["payroll-bonus-kpi", tenant] });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/bonus-assignments/${id}`),
    onSuccess: () => {
      notice.ok("Назначение удалено");
      refresh();
    },
    onError: notice.fail
  });
  const askRemove = async (a: Assign) => {
    const ok = await confirm({
      title: "Удалить назначение",
      message: `${a.formula_name ?? "Формула"} будет снята, зарплата пересчитается.`,
      confirmLabel: "Удалить",
      cancelLabel: "Отмена"
    });
    if (ok) remove.mutate(a.id);
  };

  const apply = () => {
    setFilters({ role: draftRole, users: [...draftUsers], group: draftGroup, direction: draftDirection });
    sel.clear();
  };
  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allExpanded = paged.pageRows.length > 0 && paged.pageRows.every((r) => expanded.has(r.user_id));

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="bonus" />
      <PayrollSegmentedTabs<Tab>
        tabs={[
          { id: "kpi", label: "Группа KPI (формулы)" },
          { id: "formulas", label: "Готовые формулы", count: bonusFormulas.length }
        ]}
        value={tab}
        onChange={setTab}
      />
      <PayrollFilterCard
        title="Настройки бонусов и зарплат"
        month={{ value: ym, onChange: (v) => { setYm(v); sel.clear(); } }}
        fxHref="/users/salary/formulas"
        onApply={tab === "kpi" ? apply : undefined}
      >
        {tab === "kpi" ? (
          <>
            <PayrollFloatSelect label="Роль" value={draftRole} onChange={setDraftRole} options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} />
            <SearchableMultiSelectPanel<number>
              label="Сотрудники"
              hideOuterLabel
              triggerPlaceholder="Сотрудники"
              triggerClassName={PAYROLL_FILTER_TRIGGER}
              items={everyone.filter((r) => !draftRole || r.role === draftRole).map((r) => ({ id: r.user_id, title: r.fio, subtitle: r.code, searchText: r.code }))}
              selected={draftUsers}
              onSelectedChange={setDraftUsers}
              filterItemsBySearch
              className="w-[240px]"
            />
            <PayrollFloatSelect
              label="Направление торговли"
              value={draftDirection}
              onChange={setDraftDirection}
              options={(allQ.data?.directions ?? []).map((d) => ({ value: String(d.id), label: d.name }))}
            />
            <PayrollFloatSelect label="Группа KPI" value={draftGroup} onChange={setDraftGroup} options={groups.map((g) => ({ value: String(g.id), label: g.name }))} />
          </>
        ) : null}
      </PayrollFilterCard>
      {notice.element}

      {tab === "kpi" ? (
        <PayrollTableCard
          title="Группа KPI"
          titleAction={
            editable ? (
              <Button disabled={!sel.list.length} onClick={() => setTarget({ userIds: sel.list, groupId: filters.group ? Number(filters.group) : 0 })}>
                Установка формулу{sel.list.length ? ` (${sel.list.length})` : ""}
              </Button>
            ) : null
          }
        >
          <PayrollTableToolbar
            pageSize={prefs.pageSize}
            onPageSize={prefs.setPageSize}
            search={q}
            onSearch={setQ}
            searchPlaceholder="Поиск сотрудника"
            onRefresh={refresh}
            refreshing={dataQ.isFetching}
          >
            {data?.closed ? <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white">Месяц закрыт</span> : null}
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(paged.pageRows.map((r) => r.user_id)))}
            >
              <ChevronsUpDown className="mr-1 size-4" /> {allExpanded ? "Свернуть все" : "Развернуть все"}
            </Button>
          </PayrollTableToolbar>
          <PayrollBonusTable
            rows={paged.pageRows}
            groupFilter={filters.group ? Number(filters.group) : null}
            loading={dataQ.isLoading}
            editable={editable}
            expanded={expanded}
            onExpand={toggleExpand}
            selected={sel.ids}
            onToggle={sel.toggle}
            onToggleAll={(on) => sel.setAll(paged.pageRows.map((r) => r.user_id), on)}
            onAssign={(userIds, groupId) => setTarget({ userIds, groupId })}
            onRemove={(a) => void askRemove(a)}
          />
          <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
        </PayrollTableCard>
      ) : (
        <PayrollTableCard
          title="Готовые формулы"
          titleAction={
            <Link href="/users/salary/formulas" className={buttonVariants({ variant: "outline" })}>
              Открыть «Формулы»
            </Link>
          }
        >
          <PayrollTableToolbar pageSize={prefs.pageSize} onPageSize={prefs.setPageSize} search={fq} onSearch={setFq} searchPlaceholder="Поиск формулы" onRefresh={() => void formulasQ.refetch()} refreshing={formulasQ.isFetching} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="app-table-thead">
                <tr>
                  <th className={TH}>Название</th>
                  <th className={TH}>Раздел</th>
                  <th className={TH}>Формула</th>
                  <th className={cn(TH, "text-right")}>Назначений</th>
                  <th className={TH}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {formulasQ.isLoading || formulaRows.length === 0 ? <PayrollEmptyRow colSpan={5} loading={formulasQ.isLoading} text="Формул пока нет" /> : null}
                {formulaPaged.pageRows.map((f) => (
                  <tr key={f.id} className={cn("border-b border-border/60 hover:bg-muted/40", !f.is_active && "opacity-60")}>
                    <td className={cn(TD, "font-medium")}>{f.name}</td>
                    <td className={TD}>{SCOPE_LABEL[f.scope] ?? f.scope}</td>
                    <td className={cn(TD, "max-w-lg truncate font-mono text-xs")} title={f.text}>{f.text}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{f.assignments ?? 0}</td>
                    <td className={TD}>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", f.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground")}>
                        {f.is_active ? "Активна" : "Отключена"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PayrollPagination page={formulaPaged.page} pageSize={prefs.pageSize} total={formulaPaged.total} onPage={formulaPaged.setPage} />
        </PayrollTableCard>
      )}

      <PayrollBonusAssignDialog
        target={target}
        ym={ym}
        groups={groups}
        formulas={bonusFormulas.filter((f) => f.is_active)}
        items={(itemsQ.data ?? []).filter((i) => !i.system_key && i.is_active && i.type === "allowance")}
        onClose={() => setTarget(null)}
        onDone={(t) => { notice.ok(t); sel.clear(); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}
