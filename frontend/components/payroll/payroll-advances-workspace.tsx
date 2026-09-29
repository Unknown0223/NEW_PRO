"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { ADVANCE_STATUS, currentYm, fmtDateTime, money, payrollApi, roleLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { EmptyRow, MonthField, selectCls, StatusBadge, Toolbar, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import { PayrollExcelImportDialog, type ImportPreviewRow } from "@/components/payroll/payroll-excel-import-dialog";
import { PayrollAdvanceFormDialog, type AdvanceEditTarget } from "@/components/payroll/payroll-advance-form-dialog";

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

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [ym, status, q]);
  const listQ = useQuery({ queryKey: ["payroll-advances", tenant, params], enabled: Boolean(tenant), queryFn: () => api.get<Advance[]>(`/advances?${params}`) });
  const rows = listQ.data ?? [];
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
    onSuccess: () => { notice.ok("Черновик удалён"); refresh(); },
    onError: notice.fail
  });

  const runBulk = async (action: "send" | "cancel") => {
    const allowed = selected.filter((r) => (action === "send" ? r.status === "draft" || r.status === "rejected" : ["draft", "sent", "approved", "rejected"].includes(r.status)));
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

  return (
    <PageShell>
      <PageHeader
        title="Аванс"
        description="Добавьте аванс вручную или из Excel и отправьте на утверждение. После утверждения его выдаёт кассир филиала по очереди."
        actions={
          <div className="flex gap-2">
            {can("staff.avans.import") ? <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp className="mr-1 size-4" /> Из Excel</Button> : null}
            {can("staff.avans.create") ? <Button size="sm" onClick={() => setEdit("new")}><Plus className="mr-1 size-4" /> Аванс</Button> : null}
          </div>
        }
      />
      {notice.element}
      <Toolbar>
        <MonthField value={ym} onChange={(v) => { setYm(v); sel.clear(); }} />
        <select className={selectCls("w-44")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {Object.entries(ADVANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-52" />
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">Итого: <b className="text-foreground">{money(total)}</b></span>
        {can("staff.avans.status") ? (
          <>
            <Button size="sm" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("send")}><Send className="mr-1 size-4" /> Отправить{selected.length ? ` (${selected.length})` : ""}</Button>
            <Button size="sm" variant="outline" disabled={!selected.length || bulk.isPending} onClick={() => void runBulk("cancel")}>Отменить</Button>
          </>
        ) : null}
      </Toolbar>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-xs">
            <tr>
              <th className="w-8 px-2 py-2"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(e) => sel.setAll(rows.map((r) => r.id), e.target.checked)} /></th>
              <th className="px-2">Сотрудник</th>
              <th className="px-2">Филиал</th>
              <th className="px-2 text-right">Сумма</th>
              <th className="px-2">Лимит / осталось</th>
              <th className="px-2">Статус</th>
              <th className="px-2">Создан</th>
              <th className="px-2">Отправлен / утверждён</th>
              <th className="px-2">Комментарий</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? <EmptyRow colSpan={10} text="Загрузка…" /> : null}
            {!listQ.isLoading && rows.length === 0 ? <EmptyRow colSpan={10} /> : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-2"><input type="checkbox" checked={sel.ids.has(r.id)} onChange={() => sel.toggle(r.id)} /></td>
                <td className="px-2 py-2">
                  <div className="font-medium">{r.fio}</div>
                  <div className="text-[11px] text-muted-foreground">{roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}{r.source === "excel" ? " · Excel" : ""}</div>
                </td>
                <td className="px-2 py-2">{r.branch ?? "—"}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">{money(r.amount)}</td>
                <td className="px-2 py-2 text-xs tabular-nums">{r.limit ? `${money(r.limit.max)} / ${money(r.limit.remaining)}` : "—"}</td>
                <td className="px-2 py-2">
                  <StatusBadge map={ADVANCE_STATUS} status={r.status} />
                  {r.reject_reason ? <div className="mt-0.5 max-w-40 text-[11px] text-red-700">{r.reject_reason}</div> : null}
                </td>
                <td className="px-2 py-2 text-xs">{fmtDateTime(r.created_at)}<div className="text-muted-foreground">{r.created_by ?? ""}</div></td>
                <td className="px-2 py-2 text-xs">{fmtDateTime(r.sent_at)}<div className="text-muted-foreground">{r.approved_at ? `✓ ${fmtDateTime(r.approved_at)} ${r.approved_by ?? ""}` : ""}</div></td>
                <td className="max-w-48 px-2 py-2 text-xs text-muted-foreground">{r.comment ?? ""}</td>
                <td className="px-2 py-1 text-right">
                  {r.status === "draft" || r.status === "rejected" ? (
                    <div className="flex justify-end">
                      {can("staff.avans.update") ? (
                        <Button size="icon" variant="ghost" aria-label="Изменить" onClick={() => setEdit({ id: r.id, fio: r.fio, amount: r.amount, comment: r.comment })}><Pencil className="size-4" /></Button>
                      ) : null}
                      {r.status === "draft" && can("staff.avans.delete") ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Удалить"
                          onClick={async () => {
                            if (await confirm({ title: "Удалить черновик", message: `${r.fio}: ${money(r.amount)}`, confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(r.id);
                          }}
                        >
                          <Trash2 className="size-4" />
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
