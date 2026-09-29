"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { apiFetch, useTenant } from "@/lib/api-client";
import { money, payrollApi } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";
import { PayrollExcelImportDialog } from "@/components/payroll/payroll-excel-import-dialog";
import { PayrollEmptyRow, PayrollPagination, PayrollTableCard, PayrollTableToolbar, usePagedRows } from "@/components/payroll/kit/payroll-kit-table";

export type EmployeeConfig = {
  user_id: number;
  fio: string;
  code: string | null;
  role: string;
  branch: string | null;
  is_active: boolean;
  role_base_amount: number;
  base_amount: number | null;
  effective_base_amount: number;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  comment: string | null;
};

type Draft = { base: string; desk: string };
type ImportRow = { code: string; base_amount: number | null; cash_desk: string | null };
type ImportPreview = { row: number; code: string; fio: string | null; base_amount: number | null; status: string };

const TH = "px-3 py-2.5 text-left font-medium";
const TD = "px-3 py-2.5";

export function PayrollEmployeeConfigs({
  role,
  importOpen,
  onImportOpenChange,
  onNotice
}: {
  role: string;
  importOpen: boolean;
  onImportOpenChange: (v: boolean) => void;
  onNotice: { ok: (t: string) => void; fail: (e: unknown) => void };
}) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ base: "", desk: "" });
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.base-salaries", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const listQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, inactive],
    enabled: Boolean(tenant),
    queryFn: () => api.get<EmployeeConfig[]>(`/employee-configs${inactive ? "?include_inactive=1" : ""}`)
  });
  const desksQ = useQuery({
    queryKey: ["cash-desks-min", tenant],
    enabled: Boolean(tenant),
    queryFn: () => apiFetch<{ data: Array<{ id: number; name: string; is_active: boolean }> }>(`/api/${tenant}/cash-desks`).then((r) => r.data)
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (listQ.data ?? []).filter(
      (r) => (!role || r.role === role) && (!s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s))
    );
  }, [listQ.data, q, role]);
  const paged = usePagedRows(rows, prefs.pageSize, `${role}|${q}|${inactive}`);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });

  const save = useMutation({
    mutationFn: (userId: number) =>
      api.send("PUT", `/employee-configs/${userId}`, {
        base_amount: draft.base.trim() === "" ? null : parseAmount(draft.base),
        cash_desk_id: draft.desk ? Number(draft.desk) : null
      }),
    onSuccess: () => {
      onNotice.ok("Сохранено. Зарплата сотрудника пересчитается автоматически.");
      setEditId(null);
      invalidate();
    },
    onError: onNotice.fail
  });

  const startEdit = (r: EmployeeConfig) => {
    setEditId(r.user_id);
    setDraft({ base: r.base_amount != null ? String(r.base_amount) : "", desk: r.cash_desk_id ? String(r.cash_desk_id) : "" });
  };

  return (
    <PayrollTableCard>
      <PayrollTableToolbar
        pageSize={prefs.pageSize}
        onPageSize={prefs.setPageSize}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Поиск: ФИО, код, филиал"
        onRefresh={invalidate}
        refreshing={listQ.isFetching}
      >
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="accent-primary" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
          Показать уволенных
        </label>
      </PayrollTableToolbar>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="app-table-thead">
            <tr>
              <th className={TH}>ФИО</th>
              <th className={TH}>Смарт-код</th>
              <th className={TH}>Филиал</th>
              <th className={TH}>Касса</th>
              <th className={cn(TH, "text-right")}>Оклад роли</th>
              <th className={cn(TH, "w-52 text-right")}>Базовый оклад</th>
              <th className={cn(TH, "w-28 text-center")}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={7} loading={listQ.isLoading} /> : null}
            {paged.pageRows.map((r) => {
              const editing = editId === r.user_id;
              const individual = r.base_amount != null;
              return (
                <tr key={r.user_id} className={cn("border-b border-border/60 hover:bg-muted/40", editing && "bg-primary/5", !r.is_active && "opacity-60")}>
                  <td className={cn(TD, "font-medium text-foreground")}>
                    {r.fio}
                    {r.is_active ? null : <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">уволен</span>}
                  </td>
                  <td className={cn(TD, "text-muted-foreground")}>{r.code ?? "—"}</td>
                  <td className={TD}>{r.branch ?? "—"}</td>
                  <td className={TD}>
                    {editing ? (
                      <select className={cn(NATIVE_SELECT, "min-w-40")} value={draft.desk} onChange={(e) => setDraft((d) => ({ ...d, desk: e.target.value }))}>
                        <option value="">— по филиалу —</option>
                        {(desksQ.data ?? []).filter((k) => k.is_active).map((k) => (
                          <option key={k.id} value={k.id}>{k.name}</option>
                        ))}
                      </select>
                    ) : (
                      r.cash_desk_name ?? <span className="text-muted-foreground">по филиалу</span>
                    )}
                  </td>
                  <td className={cn(TD, "text-right tabular-nums text-muted-foreground")}>{money(r.role_base_amount)}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>
                    {editing ? (
                      <GroupedNumberInput value={draft.base} placeholder="как у роли" onValueChange={(v) => setDraft((d) => ({ ...d, base: v }))} className="h-9 text-right" />
                    ) : (
                      <span className={cn("font-semibold", individual && "text-primary")} title={individual ? "Индивидуальный оклад" : "Оклад роли"}>
                        {money(r.effective_base_amount)}
                      </span>
                    )}
                  </td>
                  <td className={cn(TD, "text-center")}>
                    {!canEdit ? null : editing ? (
                      <div className="inline-flex gap-1">
                        <Button size="icon" className="h-8 w-8" aria-label="Сохранить" disabled={save.isPending} onClick={() => save.mutate(r.user_id)}>
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Отмена" onClick={() => setEditId(null)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700" aria-label="Изменить" onClick={() => startEdit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />

      <PayrollExcelImportDialog<ImportRow>
        open={importOpen}
        onOpenChange={onImportOpenChange}
        title="Импорт окладов из Excel"
        hint="Сотрудник ищется по коду. Пустой оклад — не меняется. Касса — название или код кассы."
        templateHeader={["Код", "Оклад", "Касса"]}
        templateFile="oklady-shablon.xlsx"
        mapRows={(raw) => {
          const out = raw
            .map((r) => ({
              code: cellText(pickCell(r, ["Код", "Code", "Kod"])),
              base_amount: cellNumber(pickCell(r, ["Оклад", "Base", "Oklad", "Сумма"])),
              cash_desk: cellText(pickCell(r, ["Касса", "Kassa", "Cash desk"])) || null
            }))
            .filter((r) => r.code);
          return out.length ? out : "В файле нет строк с колонкой «Код»";
        }}
        preview={async (items, apply) => {
          const res = await api.send<{ preview: ImportPreview[]; applied: number }>("POST", "/employee-configs/import", { rows: items, apply });
          return { rows: res.preview.map((p) => ({ row: p.row, code: p.code, fio: p.fio, amount: p.base_amount, status: p.status })), applied: res.applied };
        }}
        statusLabels={{ ok: "OK", not_found: "Сотрудник не найден", bad_cash_desk: "Касса не найдена", bad_amount: "Неверная сумма" }}
        onApplied={(n) => {
          onNotice.ok(`Загружено: ${n}`);
          invalidate();
        }}
      />
    </PayrollTableCard>
  );
}
