"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Pencil, Plus, Send, Trash2, XCircle } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, currentYm, fmtDateTime, money, payrollApi, roleLabel, ymLabel, ymQuery, ymToInput, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, downloadXlsx, pickCell } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { StatusBadge, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollExcelImportDialog, type ImportPreviewRow } from "@/components/payroll/payroll-excel-import-dialog";
import { PayrollAdvanceFormDialog, type AdvanceEditTarget } from "@/components/payroll/payroll-advance-form-dialog";
import { PayrollFilterCard, PayrollFloatSelect, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
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
  usePagedRows
} from "@/components/payroll/kit/payroll-kit-table";

type Advance = {
  id: number;
  user_id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  amount: number;
  currency: string;
  status: string;
  source: string;
  comment: string | null;
  created_at: string;
  created_by: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  limit: { max: number; scope: string; used: number; remaining: number } | null;
};
type ImportRow = { code: string; amount: number; comment: string | null };
type Filters = { branch: string; role: string };

const IMPORT_STATUS: Record<string, string> = {
  ok: "Готово",
  created: "Создан",
  not_found: "Код не найден",
  not_in_scope: "Вне вашей зоны",
  limit_exceeded: "Превышен лимит",
  bad_amount: "Неверная сумма"
};
const EMPTY: Filters = { branch: "", role: "" };
const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "ru"));

export function PayrollAdvancesWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const can = (k: string) => perms.isAdmin || perms.has(k);
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<AdvanceEditTarget>(null);
  const [importOpen, setImportOpen] = useState(false);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advances", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const listQ = useQuery({ queryKey: ["payroll-advances", tenant, ymQuery(ym)], enabled: Boolean(tenant), queryFn: () => api.get<Advance[]>(`/advances?${ymQuery(ym)}`) });
  const all = useMemo(() => listQ.data ?? [], [listQ.data]);
  const scoped = useMemo(
    () => all.filter((r) => (!filters.branch || r.branch === filters.branch) && (!filters.role || r.role === filters.role)),
    [all, filters]
  );
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped.filter((r) => (status === "all" || r.status === status) && (!s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s)));
  }, [scoped, status, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${ymQuery(ym)}|${status}|${filters.branch}|${filters.role}|${q}`);
  const selected = rows.filter((r) => sel.ids.has(r.id));
  const total = rows.filter((r) => r.status !== "cancelled" && r.status !== "rejected").reduce((s, r) => s + r.amount, 0);
  const countOf = (st: string) => scoped.filter((r) => r.status === st).length;

  const refresh = () => {
    sel.clear();
    void qc.invalidateQueries({ queryKey: ["payroll-advances", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-advance-employees", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-advance-approvals", tenant] });
  };

  const bulk = useMutation({
    mutationFn: (p: { action: "send" | "cancel"; ids: number[] }) => api.send<Record<string, unknown>>("POST", `/advances/${p.action}`, { ids: p.ids }),
    onSuccess: (r, p) => {
      const done = Number(r?.[p.action === "send" ? "sent" : "cancelled"] ?? 0);
      const skipped = Array.isArray(r?.skipped) ? r.skipped.length : 0;
      notice.ok(`${p.action === "send" ? "Отправлено на утверждение" : "Отменено"}: ${done}${skipped ? `, пропущено ${skipped}` : ""}`);
      refresh();
    },
    onError: notice.fail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/advances/${id}`),
    onSuccess: () => {
      notice.ok("Черновик удалён");
      refresh();
    },
    onError: notice.fail
  });

  const runBulk = async (action: "send" | "cancel") => {
    const allowed = selected.filter((r) =>
      action === "send" ? r.status === "draft" || r.status === "rejected" : ["draft", "sent", "approved", "rejected"].includes(r.status)
    );
    if (!allowed.length) {
      notice.fail(action === "send" ? "Выберите черновики или отклонённые авансы" : "Нет авансов, которые можно отменить");
      return;
    }
    const sum = allowed.reduce((s, r) => s + r.amount, 0);
    const ok = await confirm({
      title: action === "send" ? "Отправить на утверждение" : "Отменить авансы",
      message: `${allowed.length} шт. на сумму ${money(sum)}`,
      confirmLabel: action === "send" ? "Отправить" : "Отменить авансы",
      cancelLabel: "Назад",
      destructive: action === "cancel"
    });
    if (ok) bulk.mutate({ action, ids: allowed.map((r) => r.id) });
  };

  const mapRows = (xs: Array<Record<string, unknown>>): ImportRow[] | string => {
    const out: ImportRow[] = [];
    for (const x of xs) {
      const code = cellText(pickCell(x, ["Код", "Код сотрудника", "Kod", "code"]));
      const amount = cellNumber(pickCell(x, ["Сумма", "Summa", "amount"]));
      if (!code && amount == null) continue;
      out.push({ code, amount: amount ?? 0, comment: cellText(pickCell(x, ["Комментарий", "Izoh", "comment"])) || null });
    }
    return out.length ? out : "В файле нет строк с колонками «Код» и «Сумма»";
  };

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        `avans-${ymToInput(ym)}.xlsx`,
        ["Сотрудник", "Код", "Роль", "Филиал", "Сумма", "Статус", "Создан", "Комментарий"],
        rows.map((r) => [r.fio, r.code ?? "", roleLabel(r.role), r.branch ?? "", r.amount, ADVANCE_STATUS[r.status]?.label ?? r.status, fmtDateTime(r.created_at), r.comment ?? ""]),
        ymLabel(ym)
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  const pageAllOn = paged.pageRows.length > 0 && paged.pageRows.every((r) => sel.ids.has(r.id));

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="advances" />
      <PayrollFilterCard
        title="Аванс"
        description="Добавьте аванс вручную или из Excel и отправьте на утверждение. После утверждения его выдаёт кассир филиала по очереди."
        actions={
          <>
            {can("staff.avans.import") ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="mr-1.5 size-4 text-emerald-600" /> Из Excel
              </Button>
            ) : null}
            {can("staff.avans.create") ? (
              <Button onClick={() => setEdit("new")}>
                <Plus className="mr-1.5 size-4" /> Добавить
              </Button>
            ) : null}
          </>
        }
        month={{ value: ym, onChange: (v) => { setYm(v); sel.clear(); } }}
        onApply={() => { setFilters(draft); sel.clear(); }}
      >
        <PayrollFloatSelect label="Филиал" value={draft.branch} onChange={(v) => setDraft((d) => ({ ...d, branch: v }))} options={uniq(all.map((r) => r.branch)).map((b) => ({ value: b, label: b }))} />
        <PayrollFloatSelect
          label="Роль"
          value={draft.role}
          onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
          options={uniq(all.map((r) => r.role)).map((r) => ({ value: r, label: roleLabel(r) }))}
        />
      </PayrollFilterCard>
      <PayrollSegmentedTabs
        tabs={[
          { id: "all", label: "Все", count: scoped.length },
          ...Object.entries(ADVANCE_STATUS).map(([id, v]) => ({ id, label: v.label, count: countOf(id) }))
        ]}
        value={status}
        onChange={(v) => { setStatus(v); sel.clear(); }}
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
          refreshing={listQ.isFetching}
          onExport={() => void exportXlsx()}
        >
          <span className="text-sm text-muted-foreground">
            Итого: <b className="text-foreground">{money(total)}</b>
          </span>
          {can("staff.avans.status") ? (
            <>
              <Button className="h-9" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("send")}>
                <Send className="mr-1.5 size-4" /> Отправить{selected.length ? ` (${selected.length})` : ""}
              </Button>
              <Button variant="outline" className="h-9" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("cancel")}>
                <XCircle className="mr-1.5 size-4" /> Отменить
              </Button>
            </>
          ) : null}
        </PayrollTableToolbar>
        <div className="overflow-x-auto">
          <table className={PAYROLL_TABLE}>
            <thead className={PAYROLL_THEAD}>
              <tr>
                <th className={cn(TH, "w-10")}>
                  <input type="checkbox" className="size-4 accent-primary" checked={pageAllOn} onChange={(e) => sel.setAll(paged.pageRows.map((r) => r.id), e.target.checked)} aria-label="Выбрать все" />
                </th>
                <th className={TH}>Сотрудник</th>
                <th className={TH}>Филиал</th>
                <th className={cn(TH, "text-right")}>Сумма</th>
                <th className={TH}>Лимит / осталось</th>
                <th className={TH}>Статус</th>
                <th className={TH}>Создан</th>
                <th className={TH}>Отправлен / утверждён</th>
                <th className={TH}>Комментарий</th>
                <th className={cn(TH, "w-24 text-center")}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={10} loading={listQ.isLoading} /> : null}
              {paged.pageRows.map((r) => (
                <tr key={r.id} className={cn(PAYROLL_TR, sel.ids.has(r.id) && "bg-primary/5")}>
                  <td className={TD}>
                    <input type="checkbox" className="size-4 accent-primary" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} aria-label={r.fio} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium text-foreground">{r.fio}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {roleLabel(r.role)}
                      {r.code ? ` · ${r.code}` : ""}
                      {r.source === "excel" ? " · Excel" : ""}
                    </div>
                  </td>
                  <td className={cn(TD, "text-muted-foreground")}>{r.branch ?? "—"}</td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{money(r.amount)}</td>
                  <td className={cn(TD, "text-xs tabular-nums text-muted-foreground")}>{r.limit ? `${money(r.limit.max)} / ${money(r.limit.remaining)}` : "—"}</td>
                  <td className={TD}>
                    <StatusBadge map={ADVANCE_STATUS} status={r.status} />
                    {r.reject_reason ? <div className="mt-1 max-w-40 text-[11px] text-red-700">{r.reject_reason}</div> : null}
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {fmtDateTime(r.created_at)}
                    <div className="text-muted-foreground">{r.created_by ?? ""}</div>
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {fmtDateTime(r.sent_at)}
                    <div className="text-muted-foreground">{r.approved_at ? `✓ ${fmtDateTime(r.approved_at)} ${r.approved_by ?? ""}` : ""}</div>
                  </td>
                  <td className={cn(TD, "max-w-48 text-xs text-muted-foreground")}>{r.comment || "—"}</td>
                  <td className={cn(TD, "text-center")}>
                    {r.status === "draft" || r.status === "rejected" ? (
                      <div className="inline-flex gap-1.5">
                        {can("staff.avans.update") ? (
                          <PayrollIconAction label="Изменить" tone="edit" onClick={() => setEdit({ id: r.id, fio: r.fio, amount: r.amount, comment: r.comment })}>
                            <Pencil className="size-3.5" />
                          </PayrollIconAction>
                        ) : null}
                        {r.status === "draft" && can("staff.avans.delete") ? (
                          <PayrollIconAction
                            label="Удалить"
                            tone="danger"
                            onClick={async () => {
                              if (await confirm({ title: "Удалить черновик", message: `${r.fio}: ${money(r.amount)}`, confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(r.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </PayrollIconAction>
                        ) : null}
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

      <PayrollAdvanceFormDialog target={edit} ym={ym} onClose={() => setEdit(null)} onSaved={(t) => { notice.ok(t); refresh(); }} />
      <PayrollExcelImportDialog<ImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Загрузка авансов из Excel"
        hint="Колонки: Код (код сотрудника), Сумма, Комментарий. Сначала проверка, затем загрузка черновиков. Лимиты проверяются для каждой строки."
        templateHeader={["Код", "Сумма", "Комментарий"]}
        templateFile="avans-shablon.xlsx"
        mapRows={mapRows}
        preview={async (xs, apply) => {
          const r = await api.send<{ rows: Array<ImportPreviewRow & { remaining?: number | null }> }>("POST", "/advances/import", { ...ym, apply, rows: xs });
          return {
            rows: r.rows.map((x) => ({ ...x, note: x.status === "limit_exceeded" && x.remaining != null ? `доступно ${money(x.remaining)}` : undefined })),
            applied: apply ? r.rows.filter((x) => x.status === "created").length : undefined
          };
        }}
        statusLabels={IMPORT_STATUS}
        okStatuses={["ok", "created"]}
        onApplied={(n) => { notice.ok(`Загружено черновиков: ${n}`); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}
