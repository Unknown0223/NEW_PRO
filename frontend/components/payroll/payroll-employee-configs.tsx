"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Search, X } from "lucide-react";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { apiFetch, useTenant } from "@/lib/api-client";
import { money, payrollApi } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollExcelImportDialog } from "@/components/payroll/payroll-excel-import-dialog";
import { PayrollEmptyRow, PayrollPagination, PayrollTableCard, usePagedRows } from "@/components/payroll/kit/payroll-kit-table";

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
  item_amounts: Record<string, number>;
};

/** Rolga biriktirilgan надбавкалар; biriktirilmagan bo'lsa — barcha faol надбавкалар. */
export function roleAllowanceColumns(items: PayrollItem[], roleItemIds: number[] | undefined): PayrollItem[] {
  const manual = items.filter((i) => i.type === "allowance" && !i.system_key && i.is_active);
  if (!roleItemIds?.length) return manual;
  const ids = new Set(roleItemIds);
  return manual.filter((i) => ids.has(i.id));
}

type Draft = { base: string; desk: string; parts: Record<string, string> };
type ImportRow = { code: string; base_amount: number | null; cash_desk: string | null; item_amounts?: Record<string, number> };
type ImportPreview = { row: number; code: string; fio: string | null; base_amount: number | null; status: string };

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground";
const TD = "px-3 py-2.5";

export function PayrollEmployeeConfigs({
  role,
  columns,
  importOpen,
  onImportOpenChange,
  onNotice
}: {
  role: string;
  columns: PayrollItem[];
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
  const [draft, setDraft] = useState<Draft>({ base: "", desk: "", parts: {} });
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
        cash_desk_id: draft.desk ? Number(draft.desk) : null,
        item_amounts: Object.fromEntries(
          columns.map((c) => {
            const raw = draft.parts[String(c.id)]?.trim() ?? "";
            return [String(c.id), raw === "" ? null : parseAmount(raw)];
          })
        )
      }),
    onSuccess: () => {
      onNotice.ok("Оклад сотрудника сохранён. Зарплата пересчитается автоматически.");
      setEditId(null);
      invalidate();
    },
    onError: onNotice.fail
  });

  const startEdit = (r: EmployeeConfig) => {
    setEditId(r.user_id);
    setDraft({
      base: r.base_amount != null ? String(r.base_amount) : "",
      desk: r.cash_desk_id ? String(r.cash_desk_id) : "",
      parts: Object.fromEntries(columns.map((c) => [String(c.id), r.item_amounts[String(c.id)] != null ? String(r.item_amounts[String(c.id)]) : ""]))
    });
  };

  const colSpan = 6 + columns.length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="h-9 pl-9" placeholder="Поиск по ФИО, коду, филиалу..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="accent-primary" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
          Показать уволенных
        </label>
      </div>
      <PayrollTableCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className={TH}>ФИО</th>
                <th className={TH}>Смарт-код</th>
                <th className={TH}>Филиал</th>
                <th className={TH}>Касса</th>
                <th className={cn(TH, "text-right")}>Базовый оклад</th>
                {columns.map((c) => (
                  <th key={c.id} className={cn(TH, "min-w-[120px] border-l text-right")} title={c.name}>
                    <span className="line-clamp-2">{c.name}</span>
                  </th>
                ))}
                <th className={cn(TH, "w-24 border-l text-center")}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading || rows.length === 0 ? <PayrollEmptyRow colSpan={colSpan} loading={listQ.isLoading} /> : null}
              {paged.pageRows.map((r) => {
                const editing = editId === r.user_id;
                const individual = r.base_amount != null;
                return (
                  <tr
                    key={r.user_id}
                    className={cn("border-b border-border/60 align-top last:border-0 hover:bg-primary/5", editing && "bg-primary/5", !r.is_active && "opacity-60")}
                  >
                    <td className={TD}>
                      <span className="block max-w-[220px] truncate font-medium text-foreground" title={r.fio}>
                        {r.fio}
                      </span>
                      {r.is_active ? null : <span className="text-[11px] text-muted-foreground">уволен</span>}
                    </td>
                    <td className={cn(TD, "text-muted-foreground")}>{r.code ?? "—"}</td>
                    <td className={cn(TD, "text-muted-foreground")}>{r.branch ?? "—"}</td>
                    <td className={TD}>
                      {editing ? (
                        <select className={cn(NATIVE_SELECT, "h-8 min-w-[150px]")} value={draft.desk} onChange={(e) => setDraft((d) => ({ ...d, desk: e.target.value }))}>
                          <option value="">— по филиалу —</option>
                          {(desksQ.data ?? []).filter((k) => k.is_active).map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={r.cash_desk_name ? "text-foreground/80" : "text-muted-foreground/60"}>{r.cash_desk_name ?? "—"}</span>
                      )}
                    </td>
                    <td className={cn(TD, "text-right tabular-nums")}>
                      {editing ? (
                        <GroupedNumberInput
                          value={draft.base}
                          placeholder={money(r.role_base_amount)}
                          onValueChange={(v) => setDraft((d) => ({ ...d, base: v }))}
                          className="ml-auto h-8 max-w-[130px] text-right"
                        />
                      ) : (
                        <span
                          className={cn(r.effective_base_amount > 0 ? "font-semibold" : "text-muted-foreground/60", individual && "text-primary")}
                          title={individual ? "Индивидуальный оклад" : "Оклад роли"}
                        >
                          {r.effective_base_amount > 0 ? money(r.effective_base_amount) : "—"}
                        </span>
                      )}
                    </td>
                    {columns.map((c) => {
                      const v = r.item_amounts[String(c.id)];
                      return (
                        <td key={c.id} className={cn(TD, "border-l border-border/60 text-right tabular-nums")}>
                          {editing ? (
                            <GroupedNumberInput
                              value={draft.parts[String(c.id)] ?? ""}
                              placeholder="—"
                              onValueChange={(val) => setDraft((d) => ({ ...d, parts: { ...d.parts, [String(c.id)]: val } }))}
                              className="ml-auto h-8 max-w-[110px] text-right"
                            />
                          ) : (
                            <span className={v ? "text-foreground/80" : "text-muted-foreground/60"}>{v ? money(v) : "—"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cn(TD, "border-l border-border/60")}>
                      <div className="flex items-center justify-center gap-1.5">
                        {!canEdit ? null : editing ? (
                          <>
                            <button
                              type="button"
                              aria-label="Сохранить"
                              title="Сохранить"
                              disabled={save.isPending}
                              onClick={() => save.mutate(r.user_id)}
                              className="flex size-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                            >
                              <Check className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Отмена"
                              title="Отмена"
                              onClick={() => setEditId(null)}
                              className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
                            >
                              <X className="size-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Изменить: ${r.fio}`}
                            title="Изменить"
                            onClick={() => startEdit(r)}
                            className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-amber-500 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PayrollPagination page={paged.page} pageSize={prefs.pageSize} total={paged.total} onPage={paged.setPage} />
      </PayrollTableCard>

      <PayrollExcelImportDialog<ImportRow>
        open={importOpen}
        onOpenChange={onImportOpenChange}
        title="Импорт окладов из Excel"
        hint="Сотрудник ищется по коду. Пустая ячейка — значение не меняется. Касса — название или код кассы. Колонки надбавок — по названию."
        templateHeader={["Код", "Базовый оклад", "Касса", ...columns.map((c) => c.name)]}
        templateFile="oklady-shablon.xlsx"
        mapRows={(raw) => {
          const out = raw
            .map((r) => {
              const parts: Record<string, number> = {};
              for (const c of columns) {
                const v = cellNumber(pickCell(r, [c.name]));
                if (v != null) parts[String(c.id)] = v;
              }
              return {
                code: cellText(pickCell(r, ["Код", "Смарт-код", "Code", "Kod"])),
                base_amount: cellNumber(pickCell(r, ["Базовый оклад", "Оклад", "Base", "Oklad", "Сумма"])),
                cash_desk: cellText(pickCell(r, ["Касса", "Kassa", "Cash desk"])) || null,
                ...(Object.keys(parts).length ? { item_amounts: parts } : {})
              };
            })
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
    </>
  );
}
