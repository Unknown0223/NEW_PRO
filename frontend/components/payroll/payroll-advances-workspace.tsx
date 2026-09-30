"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect, filterPanelSelectClassName } from "@/components/ui/filter-select";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, currentYm, fmtDateTime, money, payrollApi, roleLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { StatusBadge, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollExcelImportDialog, type ImportPreviewRow } from "@/components/payroll/payroll-excel-import-dialog";
import { PayrollAdvanceFormDialog, type AdvanceEditTarget } from "@/components/payroll/payroll-advance-form-dialog";
import { PayrollMonthNav } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollEmptyRow, PayrollFilterField, PayrollFiltersSection, PayrollPagination, PayrollTableCard, PayrollTableToolbar, usePagedRows } from "@/components/payroll/kit/payroll-kit-table";

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

const IMPORT_STATUS: Record<string, string> = {
  ok: "Готово",
  created: "Создан",
  not_found: "Код не найден",
  not_in_scope: "Вне вашей зоны",
  limit_exceeded: "Превышен лимит",
  bad_amount: "Неверная сумма"
};
const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5 align-top";

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
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<AdvanceEditTarget>(null);
  const [importOpen, setImportOpen] = useState(false);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.advances", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (status) p.set("status", status);
    return p.toString();
  }, [ym, status]);
  const listQ = useQuery({ queryKey: ["payroll-advances", tenant, params], enabled: Boolean(tenant), queryFn: () => api.get<Advance[]>(`/advances?${params}`) });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => !s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s));
  }, [listQ.data, q]);
  const paged = usePagedRows(rows, prefs.pageSize, `${params}|${q}`);
  const selected = rows.filter((r) => sel.ids.has(r.id));
  const total = rows.filter((r) => r.status !== "cancelled" && r.status !== "rejected").reduce((s, r) => s + r.amount, 0);

  const refresh = () => {
    sel.clear();
    void qc.invalidateQueries({ queryKey: ["payroll-advances", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-advance-employees", tenant] });
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

  const pageAllOn = paged.pageRows.length > 0 && paged.pageRows.every((r) => sel.ids.has(r.id));

  return (
    <PageShell className="payroll-template">
      <PageHeader
        title="Аванс"
        description="Добавьте аванс вручную или из Excel и отправьте на утверждение. После утверждения его выдаёт кассир филиала по очереди."
        actions={
          <div className="flex gap-2">
            {can("staff.avans.import") ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="mr-1.5 size-4" /> Из Excel
              </Button>
            ) : null}
            {can("staff.avans.create") ? (
              <Button onClick={() => setEdit("new")}>
                <Plus className="mr-1.5 size-4" /> Аванс
              </Button>
            ) : null}
          </div>
        }
      />
      <PayrollFiltersSection>
        <PayrollMonthNav variant="filter" value={ym} onChange={(v) => { setYm(v); sel.clear(); }} />
        <PayrollFilterField label="Статус">
          <FilterSelect emptyLabel="Все статусы" className={filterPanelSelectClassName} value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(ADVANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </FilterSelect>
        </PayrollFilterField>
      </PayrollFiltersSection>
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
        >
          <span className="text-sm text-muted-foreground">
            Итого: <b className="text-foreground">{money(total)}</b>
          </span>
          {can("staff.avans.status") ? (
            <>
              <Button size="sm" className="h-9" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("send")}>
                <Send className="mr-1 size-4" /> Отправить{selected.length ? ` (${selected.length})` : ""}
              </Button>
              <Button size="sm" variant="outline" className="h-9" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("cancel")}>
                Отменить
              </Button>
            </>
          ) : null}
        </PayrollTableToolbar>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className={cn(TH, "w-10")}>
                  <input type="checkbox" className="accent-primary" checked={pageAllOn} onChange={(e) => sel.setAll(paged.pageRows.map((r) => r.id), e.target.checked)} aria-label="Выбрать все" />
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
                <tr key={r.id} className={cn("border-b border-border/60 hover:bg-muted/40", sel.ids.has(r.id) && "bg-primary/5")}>
                  <td className={TD}>
                    <input type="checkbox" className="accent-primary" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} aria-label={r.fio} />
                  </td>
                  <td className={TD}>
                    <div className="font-medium text-foreground">{r.fio}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {roleLabel(r.role)}
                      {r.code ? ` · ${r.code}` : ""}
                      {r.source === "excel" ? " · Excel" : ""}
                    </div>
                  </td>
                  <td className={TD}>{r.branch ?? "—"}</td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums")}>{money(r.amount)}</td>
                  <td className={cn(TD, "text-xs tabular-nums")}>{r.limit ? `${money(r.limit.max)} / ${money(r.limit.remaining)}` : "—"}</td>
                  <td className={TD}>
                    <StatusBadge map={ADVANCE_STATUS} status={r.status} />
                    {r.reject_reason ? <div className="mt-0.5 max-w-40 text-[11px] text-red-700">{r.reject_reason}</div> : null}
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {fmtDateTime(r.created_at)}
                    <div className="text-muted-foreground">{r.created_by ?? ""}</div>
                  </td>
                  <td className={cn(TD, "text-xs")}>
                    {fmtDateTime(r.sent_at)}
                    <div className="text-muted-foreground">{r.approved_at ? `✓ ${fmtDateTime(r.approved_at)} ${r.approved_by ?? ""}` : ""}</div>
                  </td>
                  <td className={cn(TD, "max-w-48 text-xs text-muted-foreground")}>{r.comment ?? ""}</td>
                  <td className={cn(TD, "text-center")}>
                    {r.status === "draft" || r.status === "rejected" ? (
                      <div className="inline-flex gap-1">
                        {can("staff.avans.update") ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                            aria-label="Изменить"
                            onClick={() => setEdit({ id: r.id, fio: r.fio, amount: r.amount, comment: r.comment })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        {r.status === "draft" && can("staff.avans.delete") ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Удалить"
                            onClick={async () => {
                              if (await confirm({ title: "Удалить черновик", message: `${r.fio}: ${money(r.amount)}`, confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(r.id);
                            }}
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
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
