"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Lock, Pencil, Plus, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { payrollApi } from "@/lib/payroll/payroll-api";
import { downloadXlsx } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { Field, NATIVE_SELECT, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollPageTitle, PayrollRelatedBar, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import {
  PAYROLL_ICON_BTN,
  PAYROLL_SECONDARY_BTN,
  PAYROLL_TABLE,
  PAYROLL_TD,
  PAYROLL_TH,
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

export type PayrollItem = {
  id: number;
  name: string;
  code: string | null;
  type: "allowance" | "deduction";
  calc_type: "formula" | "manual" | "system";
  system_key: string | null;
  sort_order: number;
  color: string | null;
  comment: string | null;
  is_active: boolean;
};

type Draft = Omit<PayrollItem, "id" | "system_key"> & { id?: number; system_key?: string | null };
type Status = "active" | "inactive";

const EMPTY: Draft = { name: "", code: null, type: "allowance", calc_type: "manual", sort_order: 100, color: null, comment: null, is_active: true };
const CALC_LABEL: Record<string, string> = { formula: "Формула", manual: "Вручную", system: "Системная" };
const TYPE_LABEL: Record<string, string> = { allowance: "Надбавка", deduction: "Удержание" };
const COLUMNS = [
  { id: "code", label: "Код" },
  { id: "type", label: "Тип" },
  { id: "calc", label: "Расчёт" },
  { id: "sort", label: "Сортировка" },
  { id: "comment", label: "Комментарий" }
];
type ItemSortKey = "name" | "code" | "type" | "sort";
const itemSortValue = (r: PayrollItem, k: ItemSortKey) => (k === "sort" ? r.sort_order : k === "code" ? r.code ?? "" : k === "type" ? r.type : r.name);
const TH = PAYROLL_TH;
const TD = PAYROLL_TD;

export function PayrollItemsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canCreate = perms.isAdmin || perms.hasAny("staff.zarplaty.create", "staff.zarplaty.update");
  const canUpdate = perms.isAdmin || perms.has("staff.zarplaty.update");
  const canDelete = perms.isAdmin || perms.has("staff.zarplaty.delete");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<Status>("active");
  const [q, setQ] = useState("");
  const [colsOpen, setColsOpen] = useState(false);
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.items", defaultColumnOrder: COLUMNS.map((c) => c.id), defaultPageSize: 20 });
  const show = (id: string) => !prefs.hiddenColumnIds.has(id);

  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const all = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) => r.is_active === (status === "active") && (!s || `${r.name} ${r.code ?? ""} ${r.comment ?? ""}`.toLowerCase().includes(s)));
  }, [all, status, q]);
  const { sorted, sort, toggle: toggleSort } = useSortedRows<PayrollItem, ItemSortKey>(rows, itemSortValue);
  const paged = usePagedRows(sorted, prefs.pageSize, `${status}|${q}|${sort?.key ?? ""}|${sort?.dir ?? ""}`);
  const editable = (r: PayrollItem) => !r.system_key && (canUpdate || canDelete);
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["payroll-items", tenant] });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        name: d.name.trim(),
        code: d.code?.trim() || null,
        type: d.type,
        calc_type: d.calc_type === "system" ? undefined : d.calc_type,
        sort_order: d.sort_order,
        color: d.color || null,
        comment: d.comment?.trim() || null,
        is_active: d.is_active
      };
      return d.id ? api.send("PATCH", `/items/${d.id}`, body) : api.send("POST", "/items", body);
    },
    onSuccess: () => {
      setDraft(null);
      notice.ok("Сохранено");
      invalidate();
    },
    onError: notice.fail
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/items/${id}`),
    onSuccess: () => {
      setDraft(null);
      notice.ok("Удалено");
      invalidate();
    },
    onError: notice.fail
  });

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        "nadbavki-i-vychety.xlsx",
        ["Название", "Код", "Тип", "Расчёт", "Сортировка", "Статус", "Комментарий"],
        rows.map((r) => [r.name, r.code ?? "", TYPE_LABEL[r.type], CALC_LABEL[r.calc_type] ?? r.calc_type, r.sort_order, r.is_active ? "Активный" : "Не активный", r.comment ?? ""]),
        "Надбавки и вычеты"
      );
    } catch (e) {
      notice.fail(e);
    }
  };

  const openRow = (r: PayrollItem) => {
    if (!editable(r)) return;
    setDraft({ ...r });
  };
  const readOnly = Boolean(draft?.id) && !canUpdate;

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="items" />
      <PayrollPageTitle
        title="Надбавки и вычеты к зарплате"
        description="Статьи зарплатной ведомости. Системные статьи (Аванс, Корректировка, Qarzdorlik) заполняются автоматически."
        actions={
          canCreate ? (
            <Button onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="mr-1.5 size-4" /> Добавить
            </Button>
          ) : null
        }
      />
      <PayrollSegmentedTabs<Status>
        variant="status"
        tabs={[
          { id: "active", label: "Активный", count: all.filter((r) => r.is_active).length },
          { id: "inactive", label: "Не активный", count: all.filter((r) => !r.is_active).length }
        ]}
        value={status}
        onChange={setStatus}
      />
      {notice.element}

      <PayrollTableCard>
        <PayrollTableToolbar
          leading={
            <button type="button" className={PAYROLL_ICON_BTN} title="Настройка колонок" aria-label="Столбцы" onClick={() => setColsOpen(true)}>
              <SlidersHorizontal className="size-4" />
            </button>
          }
          pageSize={prefs.pageSize}
          onPageSize={prefs.setPageSize}
          search={q}
          onSearch={setQ}
        >
          <button type="button" className={PAYROLL_SECONDARY_BTN} onClick={() => void exportXlsx()}>
            <FileSpreadsheet className="size-4 text-emerald-600" /> Excel
          </button>
          <button type="button" className={PAYROLL_ICON_BTN} title="Обновить" aria-label="Обновить" disabled={itemsQ.isFetching} onClick={invalidate}>
            <RefreshCw className={cn("size-4", itemsQ.isFetching && "animate-spin")} />
          </button>
        </PayrollTableToolbar>
        <div className="overflow-x-auto">
          <table className={cn(PAYROLL_TABLE, "min-w-[820px]")}>
            <thead className={PAYROLL_THEAD}>
              <tr>
                <SortTh label="Название" sortKey="name" sort={sort} onSort={toggleSort} className={TH} />
                {show("code") ? <SortTh label="Код" sortKey="code" sort={sort} onSort={toggleSort} className={TH} /> : null}
                {show("type") ? <SortTh label="Тип" sortKey="type" sort={sort} onSort={toggleSort} className={TH} /> : null}
                {show("calc") ? <th className={TH}>Расчёт</th> : null}
                {show("sort") ? <SortTh label="Сортировка" sortKey="sort" sort={sort} onSort={toggleSort} className={cn(TH, "text-center")} /> : null}
                {show("comment") ? <th className={TH}>Комментарий</th> : null}
                <th className={cn(TH, "w-14")} aria-label="Действие" />
              </tr>
            </thead>
            <tbody>
              {itemsQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={2 + COLUMNS.filter((c) => show(c.id)).length} loading={itemsQ.isLoading} /> : null}
              {paged.pageRows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openRow(r)}
                  className={cn(PAYROLL_TR, editable(r) && "cursor-pointer")}
                >
                  <td className={cn(TD, "text-[13.5px] font-medium text-foreground")}>
                    <span className="inline-flex items-center gap-2">
                      {r.color ? <span className="size-3 rounded-full" style={{ backgroundColor: r.color }} /> : null}
                      {r.name}
                      {r.system_key ? <Lock className="size-3.5 text-muted-foreground" aria-label="Системная статья" /> : null}
                    </span>
                  </td>
                  {show("code") ? <td className={cn(TD, "text-muted-foreground")}>{r.code ?? "—"}</td> : null}
                  {show("type") ? (
                    <td className={TD}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset",
                          r.type === "allowance"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-600 ring-rose-500/15 dark:bg-rose-950/40 dark:text-rose-400"
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", r.type === "allowance" ? "bg-emerald-500" : "bg-rose-400")} />
                        {TYPE_LABEL[r.type]}
                      </span>
                    </td>
                  ) : null}
                  {show("calc") ? <td className={cn(TD, "text-muted-foreground")}>{CALC_LABEL[r.calc_type] ?? r.calc_type}</td> : null}
                  {show("sort") ? <td className={cn(TD, "text-center tabular-nums")}>{r.sort_order || "—"}</td> : null}
                  {show("comment") ? <td className={cn(TD, "max-w-80 truncate text-muted-foreground")}>{r.comment || "—"}</td> : null}
                  <td className={cn(TD, "px-2 text-right")} onClick={(e) => e.stopPropagation()}>
                    {editable(r) ? (
                      <PayrollIconAction label={`Изменить: ${r.name}`} tone="edit" onClick={() => openRow(r)}>
                        <Pencil />
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

      <TableColumnSettingsDialog
        open={colsOpen}
        onOpenChange={setColsOpen}
        title="Столбцы таблицы"
        description="Название отображается всегда."
        columns={COLUMNS}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        onSave={prefs.saveColumnLayout}
        onReset={prefs.resetColumnLayout}
        saving={prefs.saving}
      />

      <Dialog open={draft != null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="payroll-template sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Изменить статью" : "Новая статья"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Название">
                <Input value={draft.name} disabled={readOnly} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Тип">
                  <select className={NATIVE_SELECT} value={draft.type} disabled={readOnly} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}>
                    <option value="allowance">Надбавка</option>
                    <option value="deduction">Удержание</option>
                  </select>
                </Field>
                <Field label="Расчёт">
                  <select className={NATIVE_SELECT} value={draft.calc_type} disabled={readOnly} onChange={(e) => setDraft({ ...draft, calc_type: e.target.value as Draft["calc_type"] })}>
                    <option value="manual">Вручную</option>
                    <option value="formula">Формула</option>
                  </select>
                </Field>
                <Field label="Код">
                  <Input value={draft.code ?? ""} disabled={readOnly} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                </Field>
                <Field label="Сортировка">
                  <Input type="number" value={draft.sort_order} disabled={readOnly} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Цвет">
                  <Input type="color" value={draft.color ?? "#64748b"} disabled={readOnly} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 p-1" />
                </Field>
                <label className="flex items-center gap-2 pt-5 text-sm">
                  <input type="checkbox" className="accent-primary" checked={draft.is_active} disabled={readOnly} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                  Активный
                </label>
              </div>
              <Field label="Комментарий">
                <Input value={draft.comment ?? ""} disabled={readOnly} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
              </Field>
              <div className="flex items-center justify-between gap-2 pt-2">
                {draft.id && canDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={remove.isPending}
                    onClick={async () => {
                      const ok = await confirm({ title: "Удалить статью", message: `Удалить «${draft.name}»?`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                      if (ok && draft.id) remove.mutate(draft.id);
                    }}
                  >
                    <Trash2 className="mr-1 size-4" /> Удалить
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDraft(null)}>Отмена</Button>
                  <Button size="sm" disabled={readOnly || !draft.name.trim() || save.isPending} onClick={() => save.mutate(draft)}>
                    Сохранить
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {dialog}
    </PageShell>
  );
}
