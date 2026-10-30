"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Search, X } from "lucide-react";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { usePermissions } from "@/lib/use-permissions";
import { apiFetch, useTenant } from "@/lib/api-client";
import { money, payrollApi, roleLabel, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { PayrollFloatSelect } from "@/components/payroll/kit/payroll-kit-layout";
import { NATIVE_SELECT, parseAmount } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollExcelImportDialog } from "@/components/payroll/payroll-excel-import-dialog";
import {
  PAYROLL_INPUT,
  PAYROLL_TD,
  PAYROLL_TH,
  PAYROLL_TR,
  PayrollEmptyRow,
  PayrollIconAction,
  PayrollPagination,
  PayrollTableCard,
  SortTh,
  usePagedRows,
  useSortedRows
} from "@/components/payroll/kit/payroll-kit-table";

export type EmployeeConfig = {
  user_id: number;
  fio: string;
  code: string | null;
  role: string;
  branch: string | null;
  territory: string | null;
  trade_direction: string | null;
  is_active: boolean;
  role_base_amount: number;
  base_amount: number | null;
  effective_base_amount: number;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  comment: string | null;
  item_amounts: Record<string, number>;
  role_item_amounts: Record<string, number>;
};

/** Rolga biriktirilgan надбавкалар; biriktirilmagan bo'lsa — barcha faol надбавкалар. */
export function roleAllowanceColumns(items: PayrollItem[], roleItemIds: number[] | undefined): PayrollItem[] {
  const manual = items.filter((i) => i.type === "allowance" && i.calc_type === "manual" && !i.system_key && i.is_active);
  if (!roleItemIds?.length) return manual;
  const ids = new Set(roleItemIds);
  return manual.filter((i) => ids.has(i.id));
}

type Draft = { base: string; desk: string; parts: Record<string, string> };
type ImportRow = { code: string; base_amount: number | null; cash_desk: string | null; item_amounts?: Record<string, number> };
type ImportPreview = { row: number; code: string; fio: string | null; base_amount: number | null; status: string };

const TH = cn(PAYROLL_TH, "px-3");
const TD = cn(PAYROLL_TD, "border-b border-[var(--pr-line)] px-3");
const COL_LINE = "border-l border-[var(--pr-line)]";

const uniq = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "ru"));

export function PayrollEmployeeConfigs({
  role,
  onRoleChange,
  onScopeChange,
  columns,
  ym,
  importOpen,
  onImportOpenChange,
  onNotice
}: {
  role: string;
  onRoleChange: (role: string) => void;
  onScopeChange?: (scope: { branch: string; direction: string }) => void;
  columns: PayrollItem[];
  ym?: Ym;
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
  const [branch, setBranch] = useState("");
  const [direction, setDirection] = useState("");
  useEffect(() => { onScopeChange?.({ branch, direction }); }, [branch, direction, onScopeChange]);
  const [inactive, setInactive] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ base: "", desk: "", parts: {} });
  const prefs = useUserTablePrefs({ tenantSlug: tenant, tableId: "payroll.base-salaries", defaultColumnOrder: ["fio"], defaultPageSize: 20 });

  const listQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, inactive, ym?.year, ym?.month],
    enabled: Boolean(tenant),
    queryFn: () => {
      const p = new URLSearchParams();
      if (inactive) p.set("include_inactive", "1");
      if (ym) { p.set("year", String(ym.year)); p.set("month", String(ym.month)); }
      const q = p.toString();
      return api.get<EmployeeConfig[]>(`/employee-configs${q ? `?${q}` : ""}`);
    }
  });
  const desksQ = useQuery({
    queryKey: ["cash-desks-min", tenant],
    enabled: Boolean(tenant),
    queryFn: () => apiFetch<{ data: Array<{ id: number; name: string; is_active: boolean }> }>(`/api/${tenant}/cash-desks`).then((r) => r.data)
  });

  type KpiGrid = {
    groups: Array<{ id: number; name: string }>;
    people: Array<{ user_id: number; role: string; kpi_ids: number[]; amounts: Record<string, number> }>;
  };
  const kpiQ = useQuery({
    queryKey: ["payroll-kpi-grid", tenant, ym?.year, ym?.month],
    enabled: Boolean(tenant && ym),
    queryFn: () => api.get<KpiGrid>(`/kpi-grid?year=${ym!.year}&month=${ym!.month}`)
  });
  const kpiPeople = useMemo(() => new Map((kpiQ.data?.people ?? []).map((p) => [p.user_id, p])), [kpiQ.data]);
  const kpiCols = useMemo(() => {
    const ids = new Set<number>();
    for (const p of kpiQ.data?.people ?? []) if (!role || p.role === role) for (const id of p.kpi_ids) ids.add(id);
    return (kpiQ.data?.groups ?? []).filter((g) => ids.has(g.id));
  }, [kpiQ.data, role]);

  const list = listQ.data ?? [];
  const opts = useMemo(() => {
    const ok = (r: EmployeeConfig, skip: "role" | "branch" | "direction") =>
      (skip === "role" || !role || r.role === role) &&
      (skip === "branch" || !branch || r.branch === branch) &&
      (skip === "direction" || !direction || r.trade_direction === direction);
    const asOpt = (values: Array<string | null | undefined>, label: (v: string) => string = (v) => v) => uniq(values).map((v) => ({ value: v, label: label(v) }));
    return {
      roles: asOpt(list.filter((r) => ok(r, "role")).map((r) => r.role), roleLabel),
      branches: asOpt(list.filter((r) => ok(r, "branch")).map((r) => r.branch)),
      directions: asOpt(list.filter((r) => ok(r, "direction")).map((r) => r.trade_direction))
    };
  }, [listQ.data, role, branch, direction]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((r) => (!role || r.role === role) && (!branch || r.branch === branch) && (!direction || r.trade_direction === direction) && (!s || `${r.fio} ${r.code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(s)));
  }, [list, q, role, branch, direction]);
  const sortGet = useCallback((r: EmployeeConfig, key: string): string | number | null => {
    if (key === "fio") return r.fio;
    if (key === "code") return r.code ?? "";
    if (key === "branch") return r.branch ?? "";
    if (key === "desk") return r.cash_desk_name ?? "";
    if (key === "fix") return r.effective_base_amount;
    if (!key.startsWith("kpi:")) return r.item_amounts[key] ?? r.role_item_amounts?.[key] ?? 0;
    const person = kpiPeople.get(r.user_id);
    const id = key.slice(4);
    return person?.kpi_ids.includes(Number(id)) ? person.amounts[id] ?? 0 : null;
  }, [kpiPeople]);
  const { sorted, sort, toggle } = useSortedRows(rows, sortGet);
  const paged = usePagedRows(sorted, prefs.pageSize, `${role}|${branch}|${direction}|${q}|${inactive}|${sort?.key ?? ""}|${sort?.dir ?? ""}`);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-kpi-grid", tenant] });
  };

  const save = useMutation({
    mutationFn: async (userId: number) => {
      await api.send("PUT", `/employee-configs/${userId}`, {
        base_amount: draft.base.trim() === "" ? null : parseAmount(draft.base),
        cash_desk_id: draft.desk ? Number(draft.desk) : null,
        ...(ym ? { year: ym.year, month: ym.month } : {}),
        item_amounts: Object.fromEntries(
          columns.map((c) => {
            const raw = draft.parts[String(c.id)]?.trim() ?? "";
            return [String(c.id), raw === "" ? null : parseAmount(raw)];
          })
        )
      });
      const person = kpiPeople.get(userId);
      if (ym && person && kpiCols.length) {
        const amounts: Record<string, number | null> = {};
        for (const g of kpiCols) {
          if (!person.kpi_ids.includes(g.id)) continue;
          const raw = draft.parts[`kpi:${g.id}`]?.trim() ?? "";
          amounts[String(g.id)] = raw === "" ? null : parseAmount(raw);
        }
        await api.send("PUT", "/kpi-grid", { year: ym.year, month: ym.month, rows: [{ user_id: userId, amounts }] });
      }
    },
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
      parts: {
        ...Object.fromEntries(columns.map((c) => [String(c.id), r.item_amounts[String(c.id)] != null ? String(r.item_amounts[String(c.id)]) : ""])),
        ...Object.fromEntries(kpiCols.map((g) => [`kpi:${g.id}`, kpiPeople.get(r.user_id)?.amounts[String(g.id)] != null ? String(kpiPeople.get(r.user_id)!.amounts[String(g.id)]) : ""]))
      }
    });
  };

  const colSpan = 6 + kpiCols.length + columns.length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input className={cn(PAYROLL_INPUT, "pl-9 pr-3")} placeholder="Поиск по ФИО, коду, филиалу..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <PayrollFloatSelect label="Роль" value={role} onChange={onRoleChange} options={opts.roles} />
        <PayrollFloatSelect label="Филиал" value={branch} onChange={setBranch} options={opts.branches} />
        <PayrollFloatSelect label="Направление" value={direction} onChange={setDirection} options={opts.directions} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="accent-primary" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />
          Показать уволенных
        </label>
      </div>
      <PayrollTableCard>
        <div className="max-h-[calc(100vh-17rem)] overflow-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-[13px]">
            <thead>
              <tr>
                <SortTh className="sticky left-0 top-0 z-30 min-w-[200px] bg-[var(--pr-head)] px-3" label="ФИО" sortKey="fio" sort={sort} onSort={toggle} />
                <SortTh className="sticky left-[200px] top-0 z-30 bg-[var(--pr-head)] px-3" label="Смарт-код" sortKey="code" sort={sort} onSort={toggle} />
                <SortTh className="sticky top-0 z-20 bg-[var(--pr-head)] px-3" label="Филиал" sortKey="branch" sort={sort} onSort={toggle} />
                <SortTh className="sticky top-0 z-20 bg-[var(--pr-head)] px-3" label="Касса" sortKey="desk" sort={sort} onSort={toggle} />
                <SortTh className="sticky top-0 z-20 bg-[var(--pr-head)] px-3 text-right [&_button]:ml-auto" label={<span title="Фикс за полный месяц. Зарплата: FIX × отработанные дни / рабочие дни табеля.">FIX</span>} sortKey="fix" sort={sort} onSort={toggle} />
                {kpiCols.map((g) => (
                  <SortTh key={g.id} className={cn("sticky top-0 z-20 bg-[var(--pr-head)] px-3 text-right [&_button]:ml-auto", COL_LINE)} label={<span className="line-clamp-2 max-w-[120px] whitespace-normal text-right" title={g.name}>{g.name}</span>} sortKey={`kpi:${g.id}`} sort={sort} onSort={toggle} />
                ))}
                {columns.map((c) => (
                  <SortTh key={c.id} className={cn("sticky top-0 z-20 bg-[var(--pr-head)] px-3 text-right [&_button]:ml-auto", COL_LINE)} label={<span className="line-clamp-2 max-w-[120px] whitespace-normal" title={`${c.name}. Сумма за месяц, в зарплате × дни табеля. Пусто — не начисляется.`}>{c.name}</span>} sortKey={String(c.id)} sort={sort} onSort={toggle} />
                ))}
                <th className={cn(TH, COL_LINE, "sticky top-0 z-20 w-24 bg-[var(--pr-head)] text-center")}>Действие</th>
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
                    className={cn(PAYROLL_TR, "group align-top", editing && "bg-[var(--pr-row-hover)]", !r.is_active && "opacity-60")}
                  >
                    <td className={cn(TD, "sticky left-0 z-10 min-w-[200px] max-w-[200px] bg-card group-hover:bg-[var(--pr-row-hover)]")}>
                      <span className="block truncate font-medium text-foreground" title={r.fio}>
                        {r.fio}
                      </span>
                      {r.is_active ? null : <span className="text-[11px] text-muted-foreground">уволен</span>}
                    </td>
                    <td className={cn(TD, "sticky left-[200px] z-10 bg-card text-muted-foreground group-hover:bg-[var(--pr-row-hover)]")}>{r.code ?? "—"}</td>
                    <td className={cn(TD, "text-muted-foreground")}>{r.branch ?? "—"}</td>
                    <td className={TD}>
                      {editing ? (
                        <select className={cn(NATIVE_SELECT, "h-8 min-w-[150px]")} value={draft.desk} onChange={(e) => setDraft((d) => ({ ...d, desk: e.target.value }))}>
                          <option value="">— по филиалу —</option>
                          {(desksQ.data ?? []).filter((k) => k.is_active).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
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
                        <span className={cn(r.effective_base_amount > 0 ? "font-semibold" : "text-muted-foreground/60", individual && "text-primary")} title="Фикс за месяц. В зарплате умножается на дни табеля.">
                          {r.effective_base_amount > 0 ? money(r.effective_base_amount) : "—"}
                        </span>
                      )}
                    </td>
                    {kpiCols.map((g) => {
                      const person = kpiPeople.get(r.user_id);
                      const linked = person?.kpi_ids.includes(g.id) ?? false;
                      const amount = person?.amounts[String(g.id)];
                      if (!linked) return <td key={g.id} className={cn(TD, COL_LINE, "text-center text-muted-foreground/30")}>—</td>;
                      return (
                        <td key={g.id} className={cn(TD, COL_LINE, "text-right tabular-nums")}>
                          {editing ? (
                            <GroupedNumberInput
                              value={draft.parts[`kpi:${g.id}`] ?? ""}
                              placeholder="—"
                              onValueChange={(val) => setDraft((d) => ({ ...d, parts: { ...d.parts, [`kpi:${g.id}`]: val } }))}
                              className="ml-auto h-8 max-w-[110px] text-right"
                            />
                          ) : (
                            <span className={amount ? "font-medium text-foreground" : "text-muted-foreground/60"}>{amount ? money(amount) : "—"}</span>
                          )}
                        </td>
                      );
                    })}
                    {columns.map((c) => {
                      const own = r.item_amounts[String(c.id)];
                      const byRole = r.role_item_amounts?.[String(c.id)];
                      const v = own ?? byRole;
                      return (
                        <td key={c.id} className={cn(TD, COL_LINE, "text-right tabular-nums")}>
                          {editing ? (
                            <GroupedNumberInput
                              value={draft.parts[String(c.id)] ?? ""}
                              placeholder={byRole ? money(byRole) : "—"}
                              onValueChange={(val) => setDraft((d) => ({ ...d, parts: { ...d.parts, [String(c.id)]: val } }))}
                              className="ml-auto h-8 max-w-[110px] text-right"
                            />
                          ) : (
                            <span
                              className={cn(!v ? "text-muted-foreground/60" : own != null ? "text-primary" : "text-foreground/80")}
                              title={own != null ? "Индивидуально" : byRole ? "По роли" : undefined}
                            >
                              {v ? money(v) : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cn(TD, COL_LINE)}>
                      <div className="flex items-center justify-center gap-1.5">
                        {!canEdit ? null : editing ? (
                          <>
                            <PayrollIconAction label="Сохранить" tone="success" disabled={save.isPending} onClick={() => save.mutate(r.user_id)}>
                              <Check />
                            </PayrollIconAction>
                            <PayrollIconAction label="Отмена" onClick={() => setEditId(null)}>
                              <X />
                            </PayrollIconAction>
                          </>
                        ) : (
                          <PayrollIconAction label={`Изменить: ${r.fio}`} tone="edit" onClick={() => startEdit(r)}>
                            <Pencil />
                          </PayrollIconAction>
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
