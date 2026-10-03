"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { fmtDateTime, money, payrollApi, STATUS_TONE } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { TonePill, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollAdvanceLimitDialog, LIMIT_SCOPE_LABEL, limitWhom, type AdvanceLimit, type LimitScope } from "@/components/payroll/payroll-advance-limit-dialog";
import { PayrollPageTitle, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  SortTh,
  usePagedRows,
  useSortedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Tab = "all" | LimitScope;
type SortKey = "whom" | "amount" | "updated";

const SCOPE_TONE: Record<LimitScope, (typeof STATUS_TONE)[keyof typeof STATUS_TONE]> = {
  global: STATUS_TONE.emerald,
  role: STATUS_TONE.sky,
  user: STATUS_TONE.amber
};
const sortValue = (l: AdvanceLimit, k: SortKey) => (k === "amount" ? l.max_amount : k === "updated" ? l.updated_at : limitWhom(l));

export function PayrollAdvanceLimitsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.avans_limity.update");
  const notice = useNotice();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<AdvanceLimit | "new" | null>(null);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advance-limits", defaultColumnOrder: ["scope"], defaultPageSize: 20 });

  const limitsQ = useQuery({ queryKey: ["payroll-advance-limits", tenant], enabled: Boolean(tenant), queryFn: () => api.get<AdvanceLimit[]>("/advance-limits") });
  const limits = useMemo(() => limitsQ.data ?? [], [limitsQ.data]);
  const global = limits.find((l) => l.scope === "global");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return limits.filter((l) => (tab === "all" || l.scope === tab) && (!s || `${limitWhom(l)} ${l.comment ?? ""}`.toLowerCase().includes(s)));
  }, [limits, tab, q]);
  const { sorted, sort, toggle } = useSortedRows<AdvanceLimit, SortKey>(rows, sortValue);
  const paged = usePagedRows(sorted, prefs.pageSize, `${tab}|${q}|${sort?.key ?? ""}|${sort?.dir ?? ""}`);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-advance-limits", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-advance-employees", tenant] });
  };

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        "limity-avansov.xlsx",
        ["Тип", "Кому", "Лимит", "Комментарий", "Изменён"],
        sorted.map((l) => [LIMIT_SCOPE_LABEL[l.scope], limitWhom(l), l.max_amount, l.comment ?? "", fmtDateTime(l.updated_at)]),
        "Лимиты авансов"
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="limits" />
      <PayrollPageTitle
        title="Лимиты авансов"
        description="Максимальная сумма авансов на сотрудника за месяц. Приоритет: исключение для сотрудника → лимит роли → общий лимит."
        actions={
          <>
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--pr-border)] bg-card px-3 text-[13px] shadow-[var(--pr-shadow)]">
              Общий лимит: <b className="text-primary">{global ? money(global.max_amount) : "не задан"}</b>
            </span>
            {canEdit ? (
              <Button onClick={() => setTarget("new")}>
                <Plus className="mr-1.5 size-4" /> Добавить
              </Button>
            ) : null}
          </>
        }
      />
      <PayrollSegmentedTabs<Tab>
        tabs={[
          { id: "all", label: "Все", count: limits.length },
          ...(Object.keys(LIMIT_SCOPE_LABEL) as LimitScope[]).map((s) => ({ id: s, label: LIMIT_SCOPE_LABEL[s], count: limits.filter((l) => l.scope === s).length }))
        ]}
        value={tab}
        onChange={setTab}
      />
      {notice.element}

      <PayrollTableCard>
        <PayrollTableToolbar
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          search={q}
          onSearch={setQ}
          onRefresh={refresh}
          refreshing={limitsQ.isFetching}
          onExport={() => void exportXlsx()}
        />
        <div className="overflow-x-auto">
          <table className={PAYROLL_TABLE}>
            <thead className={PAYROLL_THEAD}>
              <tr>
                <th className={TH}>Тип</th>
                <SortTh label="Кому" sortKey="whom" sort={sort} onSort={toggle} className={TH} />
                <SortTh label="Лимит" sortKey="amount" sort={sort} onSort={toggle} className={cn(TH, "text-right")} />
                <th className={TH}>Комментарий</th>
                <SortTh label="Изменён" sortKey="updated" sort={sort} onSort={toggle} className={TH} />
                <th className={cn(TH, "w-14")} aria-label="Действие" />
              </tr>
            </thead>
            <tbody>
              {limitsQ.isLoading || rows.length === 0 ? (
                <PayrollEmptyRow colSpan={6} loading={limitsQ.isLoading} text="Лимиты не заданы — авансы без ограничения" />
              ) : null}
              {paged.pageRows.map((l) => (
                <tr key={l.id} onClick={() => canEdit && setTarget(l)} className={cn(PAYROLL_TR, canEdit && "cursor-pointer")}>
                  <td className={TD}>
                    <TonePill {...SCOPE_TONE[l.scope]}>{LIMIT_SCOPE_LABEL[l.scope]}</TonePill>
                  </td>
                  <td className={cn(TD, "font-medium text-foreground")}>{limitWhom(l)}</td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{money(l.max_amount)}</td>
                  <td className={cn(TD, "max-w-80 truncate text-muted-foreground")}>{l.comment || "—"}</td>
                  <td className={cn(TD, "text-xs text-muted-foreground")}>{fmtDateTime(l.updated_at)}</td>
                  <td className={cn(TD, "text-right")} onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <PayrollIconAction label={`Изменить: ${limitWhom(l)}`} tone="edit" onClick={() => setTarget(l)}>
                        <Pencil className="size-3.5" />
                      </PayrollIconAction>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>

      <PayrollAdvanceLimitDialog target={target} canEdit={canEdit} onClose={() => setTarget(null)} onSaved={(t) => { notice.ok(t); refresh(); }} />
    </PageShell>
  );
}
