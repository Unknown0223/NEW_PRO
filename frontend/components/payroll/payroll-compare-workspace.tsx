"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, payrollApi, STATUS_TONE, ymLabel, ymQuery, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, downloadXlsx, readXlsxRows } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { TonePill, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollFilterCard, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_TABLE,
  PAYROLL_TD as TD,
  PAYROLL_TH as TH,
  PAYROLL_THEAD,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollPagination,
  PayrollTableCard,
  PayrollTableToolbar,
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Cell = { column: string; excel: number; system: number | null; diff: number; reasons: string[] };
type Row = { code: string; fio: string | null; user_id: number | null; record_id: number | null; cells: Cell[]; diff_total: number };
type Report = {
  batch: { id: number; created_at: string; signed_off_at: string | null; sign_off_note: string | null } | null;
  rows: Row[];
  summary: { employees: number; matched: number; with_diff: number; not_found: number };
};
type InputRow = { code: string; name: string | null; columns: Record<string, number> };
type Tab = "all" | "diff" | "match" | "missing";

const CODE_COLS = ["код", "код сотрудника", "kod", "code", "логин", "login"];
const NAME_COLS = ["фио", "сотрудник", "ф.и.о.", "fio", "имя"];
const SKIP_COLS = ["№", "n", "#", "роль", "филиал", "должность", "branch", "role"];
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const ROW_STATE: Record<Exclude<Tab, "all">, { label: string; cls: string; dot: string }> = {
  diff: { label: "Расхождение", ...STATUS_TONE.amber },
  match: { label: "Совпадает", ...STATUS_TONE.emerald },
  missing: { label: "Не найден", ...STATUS_TONE.rose }
};
const stateOf = (r: Row): Exclude<Tab, "all"> => (r.user_id == null ? "missing" : r.diff_total >= 0.01 ? "diff" : "match");

function toInput(xs: Array<Record<string, unknown>>): InputRow[] | string {
  const out: InputRow[] = [];
  for (const x of xs) {
    let code = "";
    let name: string | null = null;
    const columns: Record<string, number> = {};
    for (const [k, v] of Object.entries(x)) {
      const key = norm(k);
      if (CODE_COLS.includes(key)) code = cellText(v);
      else if (NAME_COLS.includes(key)) name = cellText(v) || null;
      else if (!SKIP_COLS.includes(key) && !key.startsWith("__empty")) {
        const n = cellNumber(v);
        if (n != null) columns[k.trim()] = n;
      }
    }
    if (code && Object.keys(columns).length) out.push({ code, name, columns });
  }
  return out.length ? out : "Не найдены строки: нужна колонка «Код» и числовые колонки (Оклад, Начислено, названия надбавок…)";
}

export function PayrollCompareWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canImport = perms.isAdmin || perms.has("staff.zarplaty.import");
  const canSign = perms.isAdmin || perms.hasAny("staff.zarplaty.import", "staff.zarplaty.approve");
  const notice = useNotice();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [tab, setTab] = useState<Tab>("diff");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.compare", defaultColumnOrder: ["code"], defaultPageSize: 20 });

  const key = ["payroll-compare", tenant, ym.year, ym.month];
  const reportQ = useQuery({ queryKey: key, enabled: Boolean(tenant), queryFn: () => api.get<Report>(`/compare?${ymQuery(ym)}`) });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const rows = toInput(await readXlsxRows(file));
      if (typeof rows === "string") throw new Error(rows);
      return api.send<Report>("POST", "/compare", { ...ym, rows });
    },
    onSuccess: (r) => {
      qc.setQueryData(key, r);
      notice.ok(`Сверка готова: совпало ${r.summary.matched} из ${r.summary.employees}`);
    },
    onError: notice.fail
  });
  const signOff = useMutation({
    mutationFn: (p: { id: number; note: string | null }) => api.send("POST", `/compare/${p.id}/sign-off`, { note: p.note }),
    onSuccess: () => {
      notice.ok("Сверка подписана");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: notice.fail
  });

  const r = reportQ.data;
  const all = useMemo(() => [...(r?.rows ?? [])].sort((a, b) => b.diff_total - a.diff_total), [r]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((x) => (tab === "all" || stateOf(x) === tab) && (!s || `${x.code} ${x.fio ?? ""}`.toLowerCase().includes(s)));
  }, [all, tab, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${ym.year}-${ym.month}|${tab}|${q}`);
  const countOf = (t: Exclude<Tab, "all">) => all.filter((x) => stateOf(x) === t).length;
  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        `sverka-${ymToInput(ym)}.xlsx`,
        ["Код", "ФИО", "Колонка", "Excel", "Система", "Разница", "Причина"],
        rows.flatMap((x) => x.cells.map((c) => [x.code, x.fio ?? "", c.column, c.excel, c.system ?? "", c.diff, c.reasons.join(" · ")])),
        ymLabel(ym)
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  const signAction = r?.batch ? (
    r.batch.signed_off_at ? (
      <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="size-4" /> Подписано {fmtDateTime(r.batch.signed_off_at)}
        {r.batch.sign_off_note ? ` — ${r.batch.sign_off_note}` : ""}
      </span>
    ) : canSign ? (
      <Button
        onClick={() => {
          const note = window.prompt(`Подписать сверку за ${ymLabel(ym)}? Комментарий (необязательно):`, "");
          if (note !== null) signOff.mutate({ id: r.batch!.id, note: note.trim() || null });
        }}
      >
        Подписать сверку
      </Button>
    ) : null
  ) : null;

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="compare" />
      <PayrollFilterCard
        title="Сверка с Excel"
        description="Пробный месяц: загрузите ведомость, посчитанную по-старому. Система покажет расхождения по каждой колонке и причину: табель, формула, факт/возвраты, план, корректировки, ручные суммы."
        actions={signAction}
        month={{ value: ym, onChange: (v) => { setYm(v); setOpen(new Set()); } }}
      />
      {notice.element}
      {canImport ? <ExcelFileDropZone onFile={(f) => upload.mutate(f)} disabled={upload.isPending} /> : null}
      <PayrollSegmentedTabs<Tab>
        tabs={[
          { id: "all", label: "Все", count: all.length },
          { id: "diff", label: "С расхождением", count: countOf("diff") },
          { id: "match", label: "Совпадает", count: countOf("match") },
          { id: "missing", label: "Не найден", count: countOf("missing") }
        ]}
        value={tab}
        onChange={setTab}
      />

      <PayrollTableCard>
        <PayrollTableToolbar
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          search={q}
          onSearch={setQ}
          searchPlaceholder="Поиск: код или ФИО"
          onRefresh={() => void reportQ.refetch()}
          refreshing={reportQ.isFetching}
          onExport={r?.batch ? () => void exportXlsx() : undefined}
        >
          {r?.batch ? <span className="text-sm text-muted-foreground">Загружено {fmtDateTime(r.batch.created_at)}</span> : null}
        </PayrollTableToolbar>
        <div className="overflow-x-auto">
          <table className={PAYROLL_TABLE}>
            <thead className={PAYROLL_THEAD}>
              <tr>
                <th className={cn(TH, "w-10")} />
                <th className={TH}>Код</th>
                <th className={TH}>ФИО</th>
                <th className={cn(TH, "text-right")}>Колонок с расхождением</th>
                <th className={cn(TH, "text-right")}>Расхождение</th>
                <th className={TH}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {reportQ.isLoading || rows.length === 0 ? (
                <PayrollEmptyRow colSpan={6} loading={reportQ.isLoading} text={r?.batch ? "Нет строк" : `За ${ymLabel(ym)} сверка ещё не загружалась`} />
              ) : null}
              {paged.pageRows.map((row) => {
                const expanded = open.has(row.code);
                const diffCells = row.cells.filter((c) => Math.abs(c.diff) >= 0.01).length;
                const state = ROW_STATE[stateOf(row)];
                return (
                  <Fragment key={row.code}>
                    <tr className={cn(PAYROLL_TR, "cursor-pointer", expanded && "bg-primary/5")} onClick={() => toggle(row.code)}>
                      <td className={TD}>{expanded ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4 text-muted-foreground" />}</td>
                      <td className={cn(TD, "text-muted-foreground")}>{row.code}</td>
                      <td className={cn(TD, "font-medium text-foreground")}>{row.fio ?? "—"}</td>
                      <td className={cn(TD, "text-right tabular-nums")}>{diffCells}</td>
                      <td className={cn(TD, "text-right font-semibold tabular-nums", row.diff_total >= 0.01 ? "text-amber-700" : "text-emerald-700")}>{money(row.diff_total, 2)}</td>
                      <td className={TD}>
                        <TonePill cls={state.cls} dot={state.dot}>{state.label}</TonePill>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-b border-border/60 bg-muted/20">
                        <td />
                        <td colSpan={5} className="px-3 py-2">
                          <table className="w-full text-xs">
                            <thead className="text-left text-muted-foreground">
                              <tr>
                                <th className="py-1.5 pr-3 font-semibold">Колонка</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Excel</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Система</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Разница</th>
                                <th className="px-3 py-1.5 font-semibold">Причина</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.cells.map((c) => {
                                const bad = Math.abs(c.diff) >= 0.01;
                                return (
                                  <tr key={c.column} className={cn("border-t border-border/50", bad && "bg-amber-50/70 dark:bg-amber-950/20")}>
                                    <td className="py-1.5 pr-3">{c.column}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{money(c.excel, 2)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{money(c.system, 2)}</td>
                                    <td className={cn("px-3 py-1.5 text-right tabular-nums", bad ? "font-semibold text-amber-800" : "text-muted-foreground")}>{money(c.diff, 2)}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{c.reasons.join(" · ")}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>
    </PageShell>
  );
}
